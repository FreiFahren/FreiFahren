import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { db, lineStations, lines, reports } from './test-db'
import { appRequestWithRedirect, resetTestEnv, setTestEnv } from './test-utils'

let stationId: string

const SPAMMER = 'SpammerAgent/1.0 (compatible)'
const SOMEONE_ELSE = 'OtherAgent/1.0 (compatible)'

/*
 * Every report from this suite trips a flag weighted 9, so it scores 1/10 — below the threshold of
 * 1 on its own, which is the situation the whole feature is about.
 */
const alwaysFiringFlag = [{ id: 'always', sql: 'SELECT 1 FROM reports WHERE report_id = ?1', weight: 9, enabled: true }]

const post = (userAgent: string) =>
    appRequestWithRedirect('/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent, 'CF-Connecting-IP': '203.0.113.9' },
        body: JSON.stringify({ stationId, source: 'web_app' }),
    })

// Only real rows matter here; the prediction path pads a quiet station with historic guesses, and
// Those are marked and are not what is under test.
const realReportsSeenBy = async (userAgent: string) => {
    const response = await appRequestWithRedirect(`/reports/${stationId}`, {
        headers: { 'User-Agent': userAgent, 'CF-Connecting-IP': '203.0.113.9' },
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as Array<{ isPredicted: boolean }>
    return body.filter((report) => !report.isPredicted)
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
    setTestEnv({
        REPORTING_ENABLED: 'true',
        CLIENT_HASH_SECRET: 'test-client-hash-secret',
        MIN_STATION_TRUST: '1',
        TRUST_FLAGS: JSON.stringify(alwaysFiringFlag),
    })
    await db.delete(reports).where(eq(reports.stationId, stationId))
})

afterEach(async () => {
    resetTestEnv()
    await db.delete(reports).where(eq(reports.stationId, stationId))
})

describe('station trust threshold', () => {
    it('hides a station whose reports do not add up to the threshold', async () => {
        expect((await post(SPAMMER)).status).toBe(200)

        expect(await realReportsSeenBy(SOMEONE_ELSE)).toHaveLength(0)
    })

    it('shows the station once enough trust accumulates there', async () => {
        // Ten reports at 1/10 each reach the threshold of 1 — the corroboration the design asks for.
        for (let i = 0; i < 10; i++) {
            expect((await post(SPAMMER)).status).toBe(200)
        }

        expect((await realReportsSeenBy(SOMEONE_ELSE)).length).toBeGreaterThan(0)
    })

    it('shows an unscored report, because null means not yet scored rather than untrusted', async () => {
        setTestEnv({ TRUST_FLAGS: '' })

        expect((await post(SPAMMER)).status).toBe(200)

        expect(await realReportsSeenBy(SOMEONE_ELSE)).toHaveLength(1)
    })

    it('applies no threshold at all when set to 0', async () => {
        setTestEnv({ MIN_STATION_TRUST: '0' })

        expect((await post(SPAMMER)).status).toBe(200)

        expect(await realReportsSeenBy(SOMEONE_ELSE)).toHaveLength(1)
    })

    // A blank value must not read as "off" — see parseMinStationTrust.
    it('falls back to the default when the setting is blank', async () => {
        setTestEnv({ MIN_STATION_TRUST: '' })

        expect((await post(SPAMMER)).status).toBe(200)

        expect(await realReportsSeenBy(SOMEONE_ELSE)).toHaveLength(0)
    })
})

describe('a suppressed client still sees its own reports', () => {
    it('shows the submitter its own report while hiding it from everyone else', async () => {
        expect((await post(SPAMMER)).status).toBe(200)

        // The whole point: nothing in what the submitter sees says it was suppressed.
        expect(await realReportsSeenBy(SPAMMER)).toHaveLength(1)
        expect(await realReportsSeenBy(SOMEONE_ELSE)).toHaveLength(0)
    })

    it('does not extend that to a different client on the same address', async () => {
        expect((await post(SPAMMER)).status).toBe(200)

        // Same IP, different user agent — a different signature, and so not the submitter.
        expect(await realReportsSeenBy(SOMEONE_ELSE)).toHaveLength(0)
    })

    it('never returns trust or the client signature in the body', async () => {
        expect((await post(SPAMMER)).status).toBe(200)

        const response = await appRequestWithRedirect(`/reports/${stationId}`, {
            headers: { 'User-Agent': SPAMMER, 'CF-Connecting-IP': '203.0.113.9' },
        })
        const body = (await response.json()) as Array<Record<string, unknown>>
        expect(body.length).toBeGreaterThan(0)
        for (const report of body) {
            expect(report).not.toHaveProperty('trust')
            expect(report).not.toHaveProperty('clientHash')
        }
    })

    /*
     * Both answers for a below-threshold station must be uncacheable, not just the owner's. The
     * edge keys by URL and never by client, so storing the empty list a non-owner receives lets it
     * be replayed to the owner on their next request — showing them their reports had vanished,
     * which is the one thing this design must not tell them. Integration tests reach the origin
     * every time and so cannot observe that replay; asserting the header is what stands in for it.
     */
    it('marks every response for a below-threshold station as uncacheable', async () => {
        expect((await post(SPAMMER)).status).toBe(200)

        const owner = await appRequestWithRedirect(`/reports/${stationId}`, {
            headers: { 'User-Agent': SPAMMER, 'CF-Connecting-IP': '203.0.113.9' },
        })
        expect(owner.headers.get('Cache-Control')).toBe('no-store')

        const nonOwner = await appRequestWithRedirect(`/reports/${stationId}`, {
            headers: { 'User-Agent': SOMEONE_ELSE, 'CF-Connecting-IP': '203.0.113.9' },
        })
        expect(nonOwner.headers.get('Cache-Control')).toBe('no-store')
    })

    // The converse: gating must not cost the cache on stations that are perfectly fine, or every
    // Station response becomes uncacheable and the edge stops absorbing the read load entirely.
    it('still caches a station whose reports clear the threshold', async () => {
        setTestEnv({ TRUST_FLAGS: '' })

        expect((await post(SPAMMER)).status).toBe(200)

        const response = await appRequestWithRedirect(`/reports/${stationId}`, {
            headers: { 'User-Agent': SOMEONE_ELSE, 'CF-Connecting-IP': '203.0.113.9' },
        })
        expect(response.headers.get('Cache-Control')).not.toBe('no-store')
    })
})
