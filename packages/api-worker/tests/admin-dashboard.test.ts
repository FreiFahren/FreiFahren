import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { AdminDashboard, AdminStatus, ModerationStatus } from '../src/modules/admin/admin-contract'
import { QUARANTINE_CONFIRMATION } from '../src/modules/admin/admin-service'
import { TelegramReportsEntrypoint } from '../src/modules/reports/telegram-reports-entrypoint'
import { db, reports, stations } from './test-db'
import { appRequestWithRedirect, fakeReportGate, resetTestEnv, setSystemTime, setTestEnv, testEnv } from './test-utils'

const headers = { 'Content-Type': 'application/json' }
let stationId: string

beforeAll(async () => {
    stationId = (await db.select({ id: stations.id }).from(stations).limit(1))[0].id
})
const cleanup = async () => {
    await db.delete(reports)
    await db.run(sql`DELETE FROM report_quarantines`)
    await db.run(sql`DELETE FROM report_moderation`)
    await db.run(sql`DELETE FROM report_moderation_events`)
}
beforeEach(async () => {
    await cleanup()
    setTestEnv({ ADMIN_AUTH_DISABLED: 'true', PUBLIC_EDGE_CACHE_DISABLED: 'true' })
    setSystemTime(new Date('2026-08-08T12:00:00Z'))
})
afterEach(async () => {
    resetTestEnv()
    setSystemTime()
    await cleanup()
})

const submit = async (source = 'web_app') => {
    const response = await appRequestWithRedirect('/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'reporter' },
        body: JSON.stringify({ stationId, source }),
    })
    expect(response.status).toBe(200)
    return (await response.json()) as { reportId: number }
}
const telegram = async () => {
    const context = createExecutionContext()
    const result = await new TelegramReportsEntrypoint(context, testEnv()).intake({
        city: 'berlin',
        report: { stationId, lineId: null, directionId: null },
    })
    await waitOnExecutionContext(context)
    expect(result.ok).toBe(true)
}
const dashboard = async (extra = '') => {
    const response = await appRequestWithRedirect(
        `/admin/v1/dashboard?scope=berlin&from=2026-08-08T00:00:00Z&to=2026-08-09T00:00:00Z&bucket=60${extra}`,
        { headers }
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    return (await response.json()) as AdminDashboard
}
const quarantine = (enabled: boolean) =>
    appRequestWithRedirect('/admin/v1/quarantine', {
        method: 'POST',
        headers,
        body: JSON.stringify({ enabled, confirmation: QUARANTINE_CONFIRMATION }),
    })

describe('private report monitoring', () => {
    it('serves city metadata through the versioned admin contract', async () => {
        const response = await appRequestWithRedirect('/admin/v1/status', { headers })
        expect(response.status).toBe(200)
        const status = (await response.json()) as AdminStatus
        expect(status.cities.find((city) => city.city === 'berlin')).toMatchObject({ displayName: 'Berlin' })
        expect(status.cities.every((city) => city.displayName.length > 0)).toBe(true)
    })

    it('fails closed when Access is not configured and rejects malformed assertions', async () => {
        setTestEnv({ ADMIN_AUTH_DISABLED: undefined, CF_ACCESS_TEAM_DOMAIN: undefined, CF_ACCESS_AUD: undefined })
        for (const path of ['/admin/v1/status', '/admin/v1/dashboard'])
            expect((await appRequestWithRedirect(path)).status).toBe(503)
        expect(
            (
                await appRequestWithRedirect('/admin/v1/quarantine', {
                    method: 'POST',
                    body: JSON.stringify({ enabled: true, confirmation: QUARANTINE_CONFIRMATION }),
                })
            ).status
        ).toBe(503)
        setTestEnv({
            ADMIN_AUTH_DISABLED: undefined,
            CF_ACCESS_TEAM_DOMAIN: 'https://access.example.com',
            CF_ACCESS_AUD: 'aud',
        })
        expect((await appRequestWithRedirect('/admin/v1/status')).status).toBe(401)
        expect(
            (await appRequestWithRedirect('/admin/v1/status', { headers: { 'Cf-Access-Jwt-Assertion': 'malformed' } }))
                .status
        ).toBe(401)
        setTestEnv({ ADMIN_AUTH_DISABLED: 'true' })
    })

    it('requires explicit confirmation and validates time windows before reading data', async () => {
        expect(
            (
                await appRequestWithRedirect('/admin/v1/quarantine', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ enabled: true }),
                })
            ).status
        ).toBe(400)
        expect(
            (
                await appRequestWithRedirect(
                    '/admin/v1/dashboard?from=2026-08-08T00:00:00Z&to=2026-01-01T00:00:00Z&bucket=5',
                    { headers }
                )
            ).status
        ).toBe(400)
        expect(
            (
                await appRequestWithRedirect(
                    '/admin/v1/dashboard?from=2026-01-01T00:00:00Z&to=2026-09-01T00:00:00Z&bucket=5',
                    { headers }
                )
            ).status
        ).toBe(400)
    })

    it('keeps legacy, zero, reduced scores, sources and unknown flag names distinct', async () => {
        fakeReportGate.intakeTrust = null
        await submit()
        fakeReportGate.intakeTrust = 0
        fakeReportGate.intakeFlags = 'future-rule,other-rule'
        await submit('mobile_app')
        fakeReportGate.intakeTrust = 0.05
        await submit('mini_app')
        fakeReportGate.intakeFlags = null
        await telegram()
        const data = await dashboard()
        expect(data.totals).toMatchObject({ total: 4, positive: 2, zero: 1, legacy: 1, held: 0, quarantined: 1 })
        expect(data.series).toHaveLength(24)
        expect(data.series[0].total).toBe(0)
        expect(data.flags.find((flag) => flag.name === 'future-rule')).toMatchObject({ total: 2, positive: 1, zero: 1 })
        expect(data.sources.map((source) => source.name).sort()).toEqual([
            'mini_app',
            'mobile_app',
            'telegram',
            'web_app',
        ])
        const filtered = await dashboard('&source=mini_app&flag=future-rule')
        expect(filtered.totals).toMatchObject({ total: 1, positive: 1 })
        expect(filtered.reports[0].gateTrust).toBe(0.05)
        expect((await dashboard('&source=telegram')).flags.find((flag) => flag.name === 'future-rule')?.total).toBe(0)
    })

    it('accepts new diagnostic names in JSON without a scoring-rule registry', async () => {
        fakeReportGate.intakeFlags = '["brand-new-rule","second-rule","brand-new-rule"]'
        await submit()
        fakeReportGate.intakeFlags = '{"brand-new-rule":true,"not-matched":false}'
        await submit()
        const data = await dashboard()
        expect(data.flags.find((flag) => flag.name === 'brand-new-rule')?.total).toBe(2)
        expect(data.flags.some((flag) => flag.name === 'not-matched')).toBe(false)
    })

    it('detects a passing-score burst from prior data only, including zero-filled intervals', async () => {
        for (let day = 1; day <= 7; day++) {
            setSystemTime(new Date(`2026-08-0${day}T12:00:00Z`))
            await submit()
        }
        setSystemTime(new Date('2026-08-08T12:00:00Z'))
        for (let i = 0; i < 15; i++) await submit()
        setSystemTime(new Date('2026-08-09T12:00:00Z'))
        for (let i = 0; i < 20; i++) await submit()
        const data = await dashboard()
        expect(data.totals.total).toBe(15)
        expect(data.series[12]).toMatchObject({
            total: 15,
            positive: 15,
            expected: { total: 1, positive: 1 },
            spike: true,
        })
        expect(data.series[11].total).toBe(0)
    })

    it('does not mistake the introduction of scoring for a positive-score attack', async () => {
        for (let day = 1; day <= 7; day++) {
            setSystemTime(new Date(`2026-08-0${day}T12:00:00Z`))
            fakeReportGate.intakeTrust = day <= 4 ? null : 1
            for (let i = 0; i < 10; i++) await submit()
        }
        setSystemTime(new Date('2026-08-08T12:00:00Z'))
        for (let i = 0; i < 15; i++) await submit()
        expect((await dashboard()).series[12]).toMatchObject({ total: 15, positive: 15, spike: false })
    })

    it('keeps gate details out of public report responses', async () => {
        fakeReportGate.intakeFlags = 'private-rule'
        await submit()
        const response = await appRequestWithRedirect(`/reports/${stationId}`, { headers: { 'User-Agent': 'viewer' } })
        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        for (const row of (await response.json()) as Record<string, unknown>[]) {
            for (const key of ['trust', 'gateTrust', 'trustFlags', 'flags', 'clientHash', 'network'])
                expect(row).not.toHaveProperty(key)
        }
    })
})

describe('emergency quarantine', () => {
    it('quarantines all history, keeps Telegram unchanged, and preserves diagnostics', async () => {
        setSystemTime(new Date('2026-07-01T12:00:00Z'))
        fakeReportGate.intakeTrust = null
        await submit()
        setSystemTime(new Date('2026-08-08T12:00:00Z'))
        fakeReportGate.intakeTrust = 0.25
        fakeReportGate.intakeFlags = 'future-rule'
        await submit('mobile_app')
        fakeReportGate.intakeFlags = null
        await telegram()
        const response = await quarantine(true)
        expect(response.status).toBe(200)
        expect((await response.json()) as object).toMatchObject({ complete: true })
        const rows = await db.select().from(reports)
        expect(rows.filter((row) => row.source !== 'telegram').every((row) => row.trust === 0)).toBe(true)
        expect(rows.find((row) => row.source === 'telegram')?.trust).toBe(1)
        const data = await dashboard()
        expect(data.totals).toMatchObject({ total: 2, positive: 2, held: 1, effectivePositive: 1, quarantined: 1 })
        expect(data.reports.find((row) => row.source === 'mobile_app')).toMatchObject({
            gateTrust: 0.25,
            trust: 0,
            flags: ['future-rule'],
            held: true,
        })
        const publicResponse = await appRequestWithRedirect(`/reports/${stationId}`, {
            headers: { 'User-Agent': 'another-viewer' },
        })
        expect(
            ((await publicResponse.json()) as { isPredicted: boolean }[]).filter((row) => !row.isPredicted)
        ).toHaveLength(1)
        const insights = await appRequestWithRedirect(`/insights/station/${stationId}`)
        expect(insights.status).toBe(200)
        expect(await insights.json()).toMatchObject({ reportCount: { value: 1 } })
        expect(insights.headers.get('Cache-Control')).toBe('no-store')
    })

    it('holds incoming reports and late gate rescores, including after normal intake resumes', async () => {
        await quarantine(true)
        const { reportId } = await submit()
        await telegram()
        expect((await db.select().from(reports).where(eq(reports.reportId, reportId)))[0].trust).toBe(0)
        // Simulates the private gate's delayed scoring write; the row was created through POST /reports.
        await db.update(reports).set({ trust: 0.5 }).where(eq(reports.reportId, reportId))
        expect((await dashboard()).reports.find((row) => row.id === reportId)).toMatchObject({
            trust: 0,
            gateTrust: 0.5,
        })
        await quarantine(false)
        await db.update(reports).set({ trust: 1 }).where(eq(reports.reportId, reportId))
        const fresh = await submit()
        expect((await db.select().from(reports).where(eq(reports.reportId, reportId)))[0].trust).toBe(0)
        expect((await db.select().from(reports).where(eq(reports.reportId, fresh.reportId)))[0].trust).toBe(1)
    })

    it('is idempotent and exposes partial city failures so the operator can retry', async () => {
        await submit()
        setTestEnv({ DB_LEIPZIG: undefined })
        const response = await quarantine(true)
        const body = (await response.json()) as { complete: boolean; cities: ModerationStatus[] }
        expect(body.complete).toBe(false)
        expect(body.cities.find((city) => city.city === 'leipzig')).toMatchObject({ enabled: null })
        expect(body.cities.find((city) => city.city === 'berlin')).toMatchObject({ enabled: true })
        resetTestEnv()
        setTestEnv({ ADMIN_AUTH_DISABLED: 'true', PUBLIC_EDGE_CACHE_DISABLED: 'true' })
        expect((await (await quarantine(true)).json()) as object).toMatchObject({ complete: true })
        const data = await dashboard()
        expect(data.reports[0]).toMatchObject({ trust: 0, gateTrust: 1 })
        const events = await db.all<{ count: number }>(sql`SELECT count(*) AS count FROM report_moderation_events`)
        expect(events[0].count).toBe(1)
    })
})
