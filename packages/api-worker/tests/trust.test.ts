import { desc, eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { loadTrustFlags, trustFromCost, type TrustFlag } from '../src/modules/reports/trust'

import { db, lineStations, lines, reports } from './test-db'
import { appRequestWithRedirect, resetTestEnv, setTestEnv } from './test-utils'

let stationId: string

const silentLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }

const flag = (overrides: Partial<TrustFlag> & Pick<TrustFlag, 'id' | 'sql'>): TrustFlag => ({
    weight: 1,
    enabled: true,
    ...overrides,
})

const putFlags = (flags: TrustFlag[]) => {
    setTestEnv({ TRUST_FLAGS: JSON.stringify(flags) })
}

const postReport = (body?: object) =>
    appRequestWithRedirect('/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'curl/8.7.1' },
        body: JSON.stringify(body ?? { stationId, source: 'web_app' }),
    })

const lastReport = async () => {
    const [row] = await db
        .select({
            reportId: reports.reportId,
            trust: reports.trust,
            trustFlags: reports.trustFlags,
            uaFamily: reports.uaFamily,
        })
        .from(reports)
        .orderBy(desc(reports.reportId))
        .limit(1)
    return row!
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

beforeEach(() => {
    setTestEnv({ REPORTING_ENABLED: 'true', CLIENT_HASH_SECRET: 'test-client-hash-secret' })
})

afterEach(() => {
    resetTestEnv()
})

describe('trust scoring on report intake', () => {
    it('scores a report that trips no flag as fully trusted', async () => {
        putFlags([flag({ id: 'never', sql: 'SELECT 0 FROM reports WHERE report_id = ?1' })])

        expect((await postReport()).status).toBe(200)

        const stored = await lastReport()
        expect(stored.trust).toBe(1)
        expect(stored.trustFlags).toBeNull()
    })

    it('reduces trust for each flag that fires, and records which ones', async () => {
        putFlags([
            flag({ id: 'tool-ua', sql: "SELECT ua_family LIKE 'curl%' FROM reports WHERE report_id = ?1", weight: 3 }),
            flag({
                id: 'no-direction',
                sql: 'SELECT direction_id IS NULL FROM reports WHERE report_id = ?1',
                weight: 1,
            }),
        ])

        expect((await postReport()).status).toBe(200)

        const stored = await lastReport()
        // Both fire, so the cost is 4 and the report needs corroboration before it counts.
        expect(stored.trust).toBeCloseTo(1 / 5, 10)
        expect(stored.trustFlags?.split(',').sort()).toEqual(['no-direction', 'tool-ua'])
    })

    // A report that is already committed must not be lost to a bad predicate.
    it('still stores a score when a flag fails to evaluate', async () => {
        putFlags([
            flag({ id: 'broken', sql: 'SELECT no_such_column FROM reports WHERE report_id = ?1', weight: 5 }),
            flag({ id: 'works', sql: 'SELECT 1 FROM reports WHERE report_id = ?1', weight: 1 }),
        ])

        expect((await postReport()).status).toBe(200)

        const stored = await lastReport()
        expect(stored.trust).toBeCloseTo(1 / 2, 10)
        expect(stored.trustFlags).toBe('works')
    })

    // Null is "not yet scored", and must stay distinguishable from a low score.
    it('leaves trust null when no flags are configured', async () => {
        expect((await postReport()).status).toBe(200)

        const stored = await lastReport()
        expect(stored.trust).toBeNull()
        expect(stored.trustFlags).toBeNull()
    })
})

describe('trust flag definitions', () => {
    it('ignores disabled flags', () => {
        const flags = loadTrustFlags(
            JSON.stringify([flag({ id: 'off', sql: 'SELECT 1', enabled: false })]),
            silentLogger
        )
        expect(flags).toHaveLength(0)
    })

    // A predicate pasted in under pressure must not be able to mutate the table.
    it.each([
        ['delete', 'DELETE FROM reports'],
        ['update', 'UPDATE reports SET trust = 1'],
        ['stacked statement', 'SELECT 1; DROP TABLE reports'],
    ])('rejects a %s definition', (_name, statement) => {
        const flags = loadTrustFlags(JSON.stringify([flag({ id: 'bad', sql: statement })]), silentLogger)
        expect(flags).toHaveLength(0)
    })

    // One malformed definition added mid-incident must not disarm the flags already working.
    it('drops only the invalid entries from a set', () => {
        const flags = loadTrustFlags(
            JSON.stringify([
                flag({ id: 'good', sql: 'SELECT 1 FROM reports WHERE report_id = ?1' }),
                flag({ id: 'bad', sql: 'DELETE FROM reports' }),
            ]),
            silentLogger
        )
        expect(flags.map((f) => f.id)).toEqual(['good'])
    })

    it('returns nothing rather than throwing when the payload is malformed', () => {
        const flags = loadTrustFlags(JSON.stringify({ not: 'an array' }), silentLogger)
        expect(flags).toEqual([])
    })

    // A truncated secret is the realistic corruption, and must not throw on the intake path.
    it('returns nothing rather than throwing when the payload is not JSON', () => {
        expect(loadTrustFlags('[{"id": "half', silentLogger)).toEqual([])
    })

    it('is inert when the definitions are unset', () => {
        expect(loadTrustFlags(undefined, silentLogger)).toEqual([])
        expect(loadTrustFlags('', silentLogger)).toEqual([])
    })
})

describe('trustFromCost', () => {
    // An honest report scores 1; a flagged one needs proportionally more corroboration. It never
    // reaches 0 — a flag makes a report need confirming, it does not decide about it.
    it.each([
        [0, 1],
        [1, 0.5],
        [2, 1 / 3],
        [9, 0.1],
    ])('maps a cost of %d to %f', (cost, expected) => {
        expect(trustFromCost(cost)).toBeCloseTo(expected, 10)
    })

    it('never reaches zero', () => {
        expect(trustFromCost(1000)).toBeGreaterThan(0)
    })
})
