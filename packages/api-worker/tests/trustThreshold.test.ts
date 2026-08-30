import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { db, lineStations, lines, reports } from './test-db'
import { appRequestWithRedirect, fakeReportGate, resetTestEnv } from './test-utils'

let stationId: string
const SUBMITTER = 'SubmitterAgent/1.0'
const OTHER_VIEWER = 'OtherAgent/1.0'

const post = (userAgent: string) =>
    appRequestWithRedirect('/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent, 'CF-Connecting-IP': '203.0.113.9' },
        body: JSON.stringify({ stationId, source: 'web_app' }),
    })

const realReportsSeenBy = async (userAgent: string) => {
    const response = await appRequestWithRedirect(`/reports/${stationId}`, {
        headers: { 'User-Agent': userAgent, 'CF-Connecting-IP': '203.0.113.9' },
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as Array<{ isPredicted: boolean }>
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
