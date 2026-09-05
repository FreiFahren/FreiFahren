import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
    TelegramReportsEntrypoint,
    type TelegramReportIntake,
} from '../src/modules/reports/telegram-reports-entrypoint'
import { referenceCacheKey } from '../src/modules/transit/reference-cache'
import { TransitNetworkDataService } from '../src/modules/transit/transit-network-data-service'
import { db, reports, stations } from './test-db'
import { appRequestWithRedirect, fakeReportGate, resetTestEnv, setTestEnv, testEnv } from './test-utils'

const intake = async (input: unknown, bindings = testEnv()) => {
    const ctx = createExecutionContext()
    const entrypoint = new TelegramReportsEntrypoint(ctx, bindings)
    const result = await entrypoint.intake(input as TelegramReportIntake)
    await waitOnExecutionContext(ctx)
    return result
}

const stationReport = async () => {
    const [station] = await db.select({ id: stations.id }).from(stations).limit(1)
    return { stationId: station.id, lineId: null as string | null, directionId: null as string | null }
}

afterEach(async () => {
    resetTestEnv()
    vi.restoreAllMocks()
    // RPC fills the real reference cache; the shared test runtime also runs cache and seed suites.
    const cache = (caches as CacheStorage & { default: Cache }).default
    await Promise.all(['stations', 'lines'].map((key) => cache.delete(new Request(referenceCacheKey('berlin', key)))))
})

describe('Telegram report intake', () => {
    it('normalizes and persists through the same pipeline as public HTTP intake', async () => {
        const report = await stationReport()
        report.directionId = report.stationId
        const response = await appRequestWithRedirect('/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...report, source: 'web_app' }),
        })
        expect(response.status).toBe(200)
        const publicReport = (await response.json()) as Record<string, unknown>
        const result = await intake({ city: 'berlin', report })
        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error('Intake failed')
        expect(result.data).toMatchObject({
            stationId: publicReport.stationId,
            lineId: publicReport.lineId,
            directionId: null,
        })
        const [stored] = await db.select().from(reports).where(eq(reports.reportId, result.data.reportId))
        expect(stored).toMatchObject({ source: 'telegram', directionId: null })
        expect(fakeReportGate.lastIntake).not.toHaveProperty('request')
        expect(fakeReportGate.lastIntake).not.toHaveProperty('turnstileToken')
    })

    it('clears a direction when no line can be inferred between two multi-line stations', async () => {
        const network = await new TransitNetworkDataService(db, 'berlin').getStations()
        const candidates = Object.entries(network).filter(([, station]) => station.lines.length > 1)
        const pair = candidates.flatMap(([stationId, station]) => {
            const direction = candidates.find(([, other]) => other.lines.every((line) => !station.lines.includes(line)))
            return direction ? [{ stationId, directionId: direction[0], lineId: null }] : []
        })[0]
        expect(pair).toBeDefined()
        const result = await intake({ city: 'berlin', report: pair })
        expect(result).toMatchObject({ ok: true, data: { stationId: pair.stationId, lineId: null, directionId: null } })
    })

    it('rejects Telegram source on public HTTP intake before calling either gate', async () => {
        const trusted = vi.fn()
        const publicIntake = vi.fn()
        setTestEnv({
            TRUSTED_REPORT_GATE: { intake: trusted },
            REPORT_GATE: { intake: publicIntake, viewer: vi.fn() },
        })
        const response = await appRequestWithRedirect('/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...(await stationReport()), source: 'telegram' }),
        })
        expect(response.status).toBe(400)
        expect(trusted).not.toHaveBeenCalled()
        expect(publicIntake).not.toHaveBeenCalled()
    })

    it.each([{}, { city: 'unknown' }, { city: { slug: 'berlin', dbBinding: 'DB' } }])(
        'rejects missing, unknown, or caller-controlled city descriptors',
        async (input) => {
            const result = await intake({ ...input, report: await stationReport() })
            expect(result).toMatchObject({ ok: false, error: { statusCode: 400 } })
            expect(fakeReportGate.lastIntake).toBeUndefined()
        }
    )

    it('rejects source and trust metadata supplied over RPC', async () => {
        const result = await intake({
            city: 'berlin',
            report: { ...(await stationReport()), source: 'web_app', trust: 1 },
        })
        expect(result).toMatchObject({ ok: false, error: { internalCode: 'VALIDATION_FAILED' } })
        expect(fakeReportGate.lastIntake).toBeUndefined()
    })

    it('fails closed when the requested city database is unavailable', async () => {
        const result = await intake(
            { city: 'leipzig', report: await stationReport() },
            { ...testEnv(), DB_LEIPZIG: undefined }
        )
        expect(result).toMatchObject({ ok: false, error: { statusCode: 503 } })
        expect(fakeReportGate.lastIntake).toBeUndefined()
    })

    it('does not use preview persistence when the trusted gate is unavailable', async () => {
        const result = await intake(
            { city: 'berlin', report: await stationReport() },
            {
                ...testEnv(),
                REPORT_GATE_MODE: 'preview-open',
                TRUSTED_REPORT_GATE: undefined,
            }
        )
        expect(result).toMatchObject({ ok: false, error: { statusCode: 503, internalCode: 'REPORT_GATE_UNAVAILABLE' } })
    })

    it('rejects unknown transit references before contacting the gate', async () => {
        const result = await intake({
            city: 'berlin',
            report: { ...(await stationReport()), directionId: 'missing-station' },
        })
        expect(result.ok).toBe(false)
        expect(fakeReportGate.lastIntake).toBeUndefined()
    })

    it('keeps a committed report successful when cache invalidation fails', async () => {
        vi.spyOn((caches as CacheStorage & { default: Cache }).default, 'delete').mockRejectedValue(
            new Error('Cache unavailable')
        )
        const result = await intake({ city: 'berlin', report: await stationReport() })
        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error('Intake failed')
        expect(await db.select().from(reports).where(eq(reports.reportId, result.data.reportId))).toHaveLength(1)
    })
})
