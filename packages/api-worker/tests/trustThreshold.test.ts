import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { db, lineStations, lines, reports } from './test-db'
import { appRequestWithRedirect, fakeReportGate, resetTestEnv, setSystemTime } from './test-utils'

let stationId: string
const SUBMITTER = 'SubmitterAgent/1.0'
const OTHER_VIEWER = 'OtherAgent/1.0'

const post = (userAgent: string) =>
    appRequestWithRedirect('/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent, 'CF-Connecting-IP': '203.0.113.9' },
        body: JSON.stringify({ stationId, source: 'web_app' }),
    })

const realReportsSeenBy = async (userAgent: string, range?: { from: Date; to: Date }) => {
    const query =
        range === undefined
            ? ''
            : `?${new URLSearchParams({ from: range.from.toISOString(), to: range.to.toISOString() })}`
    const response = await appRequestWithRedirect(`/reports/${stationId}${query}`, {
        headers: { 'User-Agent': userAgent, 'CF-Connecting-IP': '203.0.113.9' },
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as Array<{ isPredicted: boolean; timestamp: string }>
    return { response, reports: body.filter((report) => !report.isPredicted) }
}

beforeAll(async () => {
    const [line] = await db.select({ id: lines.id }).from(lines).limit(1)
    const [station] = await db
        .select({ id: lineStations.stationId })
        .from(lineStations)
        .where(eq(lineStations.lineId, line!.id))
        .limit(1)
    stationId = station!.id
})

beforeEach(async () => {
    fakeReportGate.minStationTrust = 1
    fakeReportGate.intakeTrust = 0.1
    await db.delete(reports).where(eq(reports.stationId, stationId))
})

afterEach(async () => {
    setSystemTime()
    resetTestEnv()
    await db.delete(reports).where(eq(reports.stationId, stationId))
})

describe('generic report visibility', () => {
    it('hides reports below the station threshold from other viewers', async () => {
        expect((await post(SUBMITTER)).status).toBe(200)
        expect((await realReportsSeenBy(OTHER_VIEWER)).reports).toHaveLength(0)
    })

    it('shows reports after enough trust accumulates', async () => {
        for (let i = 0; i < 10; i++) expect((await post(SUBMITTER)).status).toBe(200)
        expect((await realReportsSeenBy(OTHER_VIEWER)).reports.length).toBeGreaterThan(0)
    })

    it('does not let daytime reports expose an unconfirmed evening report in history', async () => {
        const daytime = new Date('2026-11-10T14:00:00Z')
        const evening = new Date('2026-11-10T20:00:00Z')
        setSystemTime(daytime)
        fakeReportGate.intakeTrust = 1
        expect((await post('WitnessAgent/1.0')).status).toBe(200)

        setSystemTime(evening)
        fakeReportGate.intakeTrust = 0.25
        expect((await post(SUBMITTER)).status).toBe(200)

        const history = { from: new Date('2026-11-10T00:00:00Z'), to: evening }
        const other = await realReportsSeenBy(OTHER_VIEWER, history)
        expect(other.reports.map((report) => report.timestamp)).toEqual([daytime.toISOString()])
        expect((await realReportsSeenBy(SUBMITTER, history)).reports).toHaveLength(2)
        expect(other.response.headers.get('Cache-Control')).toBe('no-store')
    })

    it.each([-45, -44, 44, 45])('accepts confirmation within 45 minutes (%s minutes)', async (minutes) => {
        const reportAt = new Date('2026-11-10T20:00:00Z')
        const witnessAt = new Date(reportAt.getTime() + minutes * 60_000)
        const submissions = [
            { at: reportAt, userAgent: SUBMITTER, trust: 0.25 },
            { at: witnessAt, userAgent: 'WitnessAgent/1.0', trust: 1 },
        ].sort((a, b) => a.at.getTime() - b.at.getTime())
        for (const submission of submissions) {
            setSystemTime(submission.at)
            fakeReportGate.intakeTrust = submission.trust
            expect((await post(submission.userAgent)).status).toBe(200)
        }

        setSystemTime(new Date('2026-11-11T12:00:00Z'))
        const history = await realReportsSeenBy(OTHER_VIEWER, {
            from: new Date('2026-11-10T19:00:00Z'),
            to: new Date('2026-11-10T21:00:00Z'),
        })
        expect(history.reports).toHaveLength(2)

        const narrow = await realReportsSeenBy(OTHER_VIEWER, {
            from: reportAt,
            to: new Date(reportAt.getTime() + 60_000),
        })
        expect(narrow.reports.map((report) => report.timestamp)).toEqual([reportAt.toISOString()])
    })

    it.each([-1, 1])('rejects confirmation more than 45 minutes away (%s)', async (direction) => {
        const reportAt = new Date('2026-11-10T20:00:00Z')
        const witnessAt = new Date(reportAt.getTime() + direction * (45 * 60_000 + 1))
        const submissions = [
            { at: reportAt, userAgent: SUBMITTER, trust: 0.25 },
            { at: witnessAt, userAgent: 'WitnessAgent/1.0', trust: 1 },
        ].sort((a, b) => a.at.getTime() - b.at.getTime())
        for (const submission of submissions) {
            setSystemTime(submission.at)
            fakeReportGate.intakeTrust = submission.trust
            expect((await post(submission.userAgent)).status).toBe(200)
        }

        const history = await realReportsSeenBy(OTHER_VIEWER, {
            from: new Date('2026-11-10T19:00:00Z'),
            to: new Date('2026-11-10T21:00:00Z'),
        })
        expect(history.reports.map((report) => report.timestamp)).toEqual([witnessAt.toISOString()])
    })

    it('preserves the legacy neutral meaning of null trust', async () => {
        fakeReportGate.intakeTrust = null
        expect((await post(SUBMITTER)).status).toBe(200)
        expect((await realReportsSeenBy(OTHER_VIEWER)).reports).toHaveLength(1)
    })

    it('keeps pending reports owner-only even when the station already clears the threshold', async () => {
        fakeReportGate.intakeTrust = 1
        expect((await post(SUBMITTER)).status).toBe(200)
        fakeReportGate.intakeTrust = 0
        expect((await post(SUBMITTER)).status).toBe(200)

        expect((await realReportsSeenBy(SUBMITTER)).reports).toHaveLength(2)
        expect((await realReportsSeenBy(OTHER_VIEWER)).reports).toHaveLength(1)
    })

    it('keeps pending reports owner-only when the configured threshold is zero', async () => {
        fakeReportGate.minStationTrust = 0
        fakeReportGate.intakeTrust = 0
        expect((await post(SUBMITTER)).status).toBe(200)
        expect((await realReportsSeenBy(SUBMITTER)).reports).toHaveLength(1)
        expect((await realReportsSeenBy(OTHER_VIEWER)).reports).toHaveLength(0)
    })

    it('does not expose gate metadata and disables shared caching for personalized answers', async () => {
        expect((await post(SUBMITTER)).status).toBe(200)
        const owner = await realReportsSeenBy(SUBMITTER)
        const other = await realReportsSeenBy(OTHER_VIEWER)

        for (const report of owner.reports as Array<Record<string, unknown>>) {
            expect(report).not.toHaveProperty('trust')
            expect(report).not.toHaveProperty('clientHash')
            expect(report).not.toHaveProperty('trustFlags')
        }
        expect(owner.response.headers.get('Cache-Control')).toBe('no-store')
        expect(other.response.headers.get('Cache-Control')).toBe('no-store')
    })

    it('fails closed when viewer context is unavailable', async () => {
        fakeReportGate.unavailable = true
        const response = await appRequestWithRedirect(`/reports/${stationId}`)
        expect(response.status).toBe(503)
    })
})
