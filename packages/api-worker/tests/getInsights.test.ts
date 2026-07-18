import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { lineStations, lines, reports } from '../src/db'
import { resolveProfileScope, stationInsightsSchema } from '../src/modules/insights'
import { appRequestWithRedirect, sendReportRequest, setSystemTime } from './test-utils'
import { db } from './test-db'

let stationId: string
let lineId: string

const sendReportAt = async (timestamp: Date) => {
    setSystemTime(timestamp)
    expect((await sendReportRequest({ stationId, lineId, source: 'telegram' })).status).toBe(200)
}

describe('GET /insights/station/:stationId', () => {
    beforeAll(async () => {
        const [line] = await db.select({ id: lines.id }).from(lines).limit(1)
        lineId = line.id
        const [station] = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, lineId))
            .limit(1)
        stationId = station.stationId
    })

    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(async () => {
        await db.delete(reports)
        setSystemTime()
    })

    it('returns a city-scoped 7 by 24 historic profile with self-describing count ranges', async () => {
        const reportTime = new Date('2026-07-14T09:15:00.000Z')
        const now = new Date('2026-07-15T12:00:00.000Z')
        await sendReportAt(reportTime)
        setSystemTime(now)

        const response = await appRequestWithRedirect(`/insights/station/${stationId}`)

        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('public, max-age=86400')

        const body = stationInsightsSchema.parse(await response.json())
        expect(body.scope).toEqual({ kind: 'city', city: 'berlin' })
        expect(body.profile.values).toHaveLength(168)
        expect(body.profile.values.find((bucket) => bucket.dayOfWeek === 2 && bucket.hour === 11)?.reportCount).toBe(1)
        expect(body.profile.sourceRange.start).toBe(reportTime.toISOString())
        expect(body.profile.sourceRange.end).toBe(now.toISOString())
        expect(body.reportCount).toEqual({
            value: 1,
            range: {
                start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                end: now.toISOString(),
            },
        })
        expect(body.ranking.metric.range).toEqual(body.reportCount.range)
    })

    it('returns the standard station-not-found error', async () => {
        const response = await appRequestWithRedirect('/insights/station/UNKNOWN_STATION')

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toMatchObject({ details: { internal_code: 'STATION_NOT_FOUND' } })
    })
})

describe('insight scope resolution', () => {
    it('uses a line only for thin stations served by exactly one qualifying line', () => {
        expect(
            resolveProfileScope({
                stationId: 'station',
                stationLines: ['U8'],
                stationReportCount: 249,
                lineReportCount: 1500,
                citySlug: 'berlin',
            })
        ).toEqual({ kind: 'line', lineId: 'U8' })
        expect(
            resolveProfileScope({
                stationId: 'station',
                stationLines: ['U8', 'U2'],
                stationReportCount: 249,
                lineReportCount: 1500,
                citySlug: 'berlin',
            })
        ).toEqual({ kind: 'city', city: 'berlin' })
        expect(
            resolveProfileScope({
                stationId: 'station',
                stationLines: ['U8'],
                stationReportCount: 250,
                lineReportCount: 1500,
                citySlug: 'berlin',
            })
        ).toEqual({ kind: 'station', stationId: 'station' })
    })
})
