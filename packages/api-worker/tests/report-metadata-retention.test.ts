import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import {
    clearExpiredReportMetadataForAllCities,
    REPORT_METADATA_RETENTION_DAYS,
} from '../src/modules/reports/report-metadata-retention'
import { db, reports, stations } from './test-db'
import { fakeReportGate, resetTestEnv, sendReportRequest, setSystemTime, testEnv } from './test-utils'

const DAY_MS = 24 * 60 * 60 * 1000

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
    afterEach(() => {
        setSystemTime()
        resetTestEnv()
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
})
