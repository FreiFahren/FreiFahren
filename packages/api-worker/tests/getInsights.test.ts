import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { lineStations, reports } from '../src/db'
import { lineInsightsSchema, stationInsightsSchema } from '../src/modules/insights'
import { appRequestWithRedirect, sendReportRequest, setSystemTime } from './test-utils'
import { db } from './test-db'

let stationId: string
let lineId: string

const sendReportAt = async (timestamp: Date) => {
    setSystemTime(timestamp)
    expect((await sendReportRequest({ stationId, source: 'telegram' })).status).toBe(200)
}

describe('GET /insights/station/:stationId', () => {
    beforeAll(async () => {
        const [station] = await db
            .select({ stationId: lineStations.stationId, lineId: lineStations.lineId })
            .from(lineStations)
            .limit(1)
        stationId = station.stationId
        lineId = station.lineId
    })

    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(async () => {
        await db.delete(reports)
        setSystemTime()
    })

    it('returns the station report count and rank for a self-describing 30-day range', async () => {
        const reportTime = new Date('2026-07-14T09:15:00.000Z')
        const now = new Date('2026-07-15T12:00:00.000Z')
        await sendReportAt(reportTime)
        setSystemTime(now)

        const response = await appRequestWithRedirect(`/insights/station/${stationId}`)

        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('public, max-age=86400')

        const responseBody = await response.json()
        expect(responseBody).toEqual({
            reportCount: {
                value: 1,
                range: {
                    start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                    end: now.toISOString(),
                },
            },
            ranking: { position: 1, population: expect.any(Number) },
        })
        expect(stationInsightsSchema.parse(responseBody)).toEqual(responseBody)
    })

    it('returns the standard station-not-found error', async () => {
        const response = await appRequestWithRedirect('/insights/station/UNKNOWN_STATION')

        expect(response.status).toBe(404)
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBeNull()
        await expect(response.json()).resolves.toMatchObject({ details: { internal_code: 'STATION_NOT_FOUND' } })
    })
})

describe('GET /insights/line/:lineId', () => {
    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(async () => {
        await db.delete(reports)
        setSystemTime()
    })

    it('falls back to the citywide weekday profile when the line data is too sparse', async () => {
        const previousMonday = new Date('2026-07-06T12:15:00.000Z')
        const now = new Date('2026-07-13T12:00:00.000Z')
        setSystemTime(previousMonday)
        expect((await sendReportRequest({ stationId, lineId, source: 'telegram' })).status).toBe(200)
        setSystemTime(new Date('2026-07-13T09:30:00.000Z'))
        expect((await sendReportRequest({ stationId, lineId, source: 'telegram' })).status).toBe(200)
        setSystemTime(now)

        const response = await appRequestWithRedirect(`/insights/line/${lineId}`)

        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('public, max-age=86400')

        const responseBody = await response.json()
        expect(responseBody).toMatchObject({
            profile: {
                source: 'city_reports',
                metric: {
                    name: 'report_count',
                    range: {
                        start: previousMonday.toISOString(),
                        end: now.toISOString(),
                    },
                },
                weekday: 1,
                hours: expect.arrayContaining([
                    { hour: 14, value: 1 },
                    { hour: 11, value: 1 },
                ]),
            },
            hotspots: {
                source: 'reports',
                metric: { name: 'report_count' },
                stations: [{ stationId, value: 2, share: 1 }],
            },
        })
        expect(lineInsightsSchema.parse(responseBody)).toEqual(responseBody)
    })

    it('returns the standard line-not-found error', async () => {
        const response = await appRequestWithRedirect('/insights/line/UNKNOWN_LINE')

        expect(response.status).toBe(404)
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBeNull()
        await expect(response.json()).resolves.toMatchObject({ details: { internal_code: 'LINE_NOT_FOUND' } })
    })
})
