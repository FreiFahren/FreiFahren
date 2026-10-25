import { env } from 'cloudflare:test'
import { count, eq, isNotNull, sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { type ErrorReporter, setErrorReporter } from '../src/app-env'
import {
    clearExpiredReportMetadata,
    clearExpiredReportMetadataForAllCities,
    REPORT_METADATA_BATCH_SIZE,
    REPORT_METADATA_RETENTION_DAYS,
} from '../src/modules/reports/report-metadata-retention'
import { createD1Db, db, reports, stations } from './test-db'
import { fakeReportGate, resetTestEnv, sendReportRequest, setSystemTime, testEnv } from './test-utils'

const DAY_MS = 24 * 60 * 60 * 1000

// Production D1 rejects queries that bind more than this many parameters.
const D1_MAX_BOUND_PARAMETERS = 100

const recordBoundParameters = (d1: D1Database, boundCounts: number[]): D1Database =>
    new Proxy(d1, {
        get: (target, property) => {
            if (property === 'prepare') {
                return (query: string) => {
                    const statement = target.prepare(query)
                    boundCounts.push(0)
                    const index = boundCounts.length - 1
                    return new Proxy(statement, {
                        get: (stmt, key) => {
                            if (key === 'bind') {
                                return (...values: unknown[]) => {
                                    boundCounts[index] = values.length
                                    return stmt.bind(...values)
                                }
                            }
                            const value = Reflect.get(stmt, key)
                            return typeof value === 'function' ? value.bind(stmt) : value
                        },
                    })
                }
            }
            const value = Reflect.get(target, property)
            return typeof value === 'function' ? value.bind(target) : value
        },
    })

const failingD1 = (): D1Database =>
    new Proxy(env.DB, {
        get: () => () => {
            throw new Error('database unavailable')
        },
    })

// Inserted directly: thousands of submissions through the API would make the boundary cases too slow.
const insertReportsWithMetadata = async (amount: number, stationId: string, timestamp: Date) => {
    if (amount === 0) return
    await db.run(sql`
        WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${amount})
        INSERT INTO reports (station_id, timestamp, source, asn, as_organization, ua_family, client_hash, trust, trust_flags)
        SELECT ${stationId}, ${timestamp.getTime()}, 'web_app', 1, 'org', 'family', 'hash', 1, 'some-rule' FROM n
    `)
}

const reportsWithMetadata = async () => {
    const [row] = await db.select({ total: count() }).from(reports).where(isNotNull(reports.clientHash))
    return row.total
}

const submitReport = async (stationId: string) => {
    const response = await sendReportRequest({ stationId, source: 'web_app' })
    expect(response.status).toBe(200)
    return ((await response.json()) as { reportId: number }).reportId
}

const storedReport = async (reportId: number) => {
    const [row] = await db.select().from(reports).where(eq(reports.reportId, reportId))
    return row
}

describe('report metadata retention', () => {
    afterEach(async () => {
        setSystemTime()
        resetTestEnv()
        setErrorReporter(() => undefined)
        await db.delete(reports)
    })

    it('clears per-client metadata once a report is older than the retention period', async () => {
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)
        fakeReportGate.intakeFlags = 'some-rule'

        const start = new Date('2026-01-01T12:00:00Z')
        setSystemTime(start)
        const expiredId = await submitReport(station.id)

        setSystemTime(new Date(start.getTime() + 2 * DAY_MS))
        const recentId = await submitReport(station.id)

        const cleanupAt = start.getTime() + (REPORT_METADATA_RETENTION_DAYS + 1) * DAY_MS
        await clearExpiredReportMetadataForAllCities(testEnv(), cleanupAt)

        const expired = await storedReport(expiredId)
        expect(expired).toMatchObject({
            clientHash: null,
            asn: null,
            asOrganization: null,
            uaFamily: null,
            trustFlags: null,
            stationId: station.id,
        })
        expect(expired.trust).toBe(1)

        const recent = await storedReport(recentId)
        expect(recent.clientHash).not.toBeNull()
        expect(recent.trustFlags).toBe('some-rule')
    })

    it.each([0, 1, 95, 96, REPORT_METADATA_BATCH_SIZE + 1])(
        'clears %i expired reports while every query stays within the D1 parameter limit',
        async (amount) => {
            await db.delete(reports)
            const [station] = await db.select({ id: stations.id }).from(stations).limit(1)
            const now = new Date('2026-06-01T12:00:00Z').getTime()
            await insertReportsWithMetadata(
                amount,
                station.id,
                new Date(now - (REPORT_METADATA_RETENTION_DAYS + 1) * DAY_MS)
            )
            await insertReportsWithMetadata(3, station.id, new Date(now - DAY_MS))

            const boundCounts: number[] = []
            const cleared = await clearExpiredReportMetadata(
                createD1Db(recordBoundParameters(env.DB, boundCounts)),
                now
            )

            expect(cleared).toBe(amount)
            expect(await reportsWithMetadata()).toBe(3)
            expect(boundCounts.length).toBeGreaterThan(0)
            for (const bound of boundCounts) expect(bound).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMETERS)
        }
    )

    it('keeps clearing the remaining cities when one city fails', async () => {
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)
        const now = new Date('2026-06-01T12:00:00Z').getTime()
        await insertReportsWithMetadata(2, station.id, new Date(now - (REPORT_METADATA_RETENTION_DAYS + 1) * DAY_MS))

        const reported: Parameters<ErrorReporter>[] = []
        setErrorReporter((error, context) => reported.push([error, context]))

        await clearExpiredReportMetadataForAllCities({ ...testEnv(), DB: failingD1() }, now)

        expect(reported).toHaveLength(1)
        expect(reported[0][1]).toEqual({ tags: { task: 'report-metadata-retention', city: 'berlin' } })
        expect(await reportsWithMetadata()).toBe(0)
    })
})
