import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'

import { lines, lineStations, reports } from '../src/db'
import { lineInsightsSchema, stationInsightsSchema } from '../src/modules/insights'
import { appRequestWithRedirect, sendReportRequest, setSystemTime } from './test-utils'
import { db } from './test-db'

let stationId: string
let lineId: string
let lineName: string
let lineVariantCount: number
let multiVariantLineName: string
let variantLineIds: string[]
let variantStationIds: string[]

const sendReportAt = async (timestamp: Date) => {
    setSystemTime(timestamp)
    expect((await sendReportRequest({ stationId, source: 'web_app' })).status).toBe(200)
}

beforeAll(async () => {
    const [station] = await db
        .select({ stationId: lineStations.stationId, lineId: lines.id, lineName: lines.name })
        .from(lineStations)
        .innerJoin(lines, eq(lines.id, lineStations.lineId))
        .limit(1)
    stationId = station.stationId
    lineId = station.lineId
    lineName = station.lineName

    const seededLines = await db.select({ id: lines.id, name: lines.name }).from(lines)
    lineVariantCount = seededLines.filter((line) => line.name === lineName).length
    const variantsByName = new Map<string, typeof seededLines>()
    for (const line of seededLines) {
        const variants = variantsByName.get(line.name) ?? []
        variants.push(line)
        variantsByName.set(line.name, variants)
    }
    const multiVariantLine = [...variantsByName].find(([, variants]) => variants.length > 1)
    if (!multiVariantLine) throw new Error('Expected seeded data to include a multi-variant line')
    multiVariantLineName = multiVariantLine[0]
    variantLineIds = multiVariantLine[1].map((line) => line.id)
    variantStationIds = await Promise.all(
        variantLineIds.map(async (variantLineId) => {
            const [lineStation] = await db
                .select({ stationId: lineStations.stationId })
                .from(lineStations)
                .where(eq(lineStations.lineId, variantLineId))
                .limit(1)
            return lineStation.stationId
        })
    )
})

describe('GET /insights/station/:stationId', () => {
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

    it('keeps the regular one-day CDN cache across city-local midnight', async () => {
        setSystemTime(new Date('2026-07-13T21:59:30.000Z'))

        const response = await appRequestWithRedirect(`/insights/station/${stationId}`)

        expect(response.status).toBe(200)
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('public, max-age=86400')
    })

    it('returns the standard station-not-found error', async () => {
        const response = await appRequestWithRedirect('/insights/station/UNKNOWN_STATION')

        expect(response.status).toBe(404)
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBeNull()
        await expect(response.json()).resolves.toMatchObject({ details: { internal_code: 'STATION_NOT_FOUND' } })
    })
})

describe('GET /insights/lines/:lineName', () => {
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
        expect((await sendReportRequest({ stationId, lineId, source: 'web_app' })).status).toBe(200)
        setSystemTime(new Date('2026-07-13T09:30:00.000Z'))
        expect((await sendReportRequest({ stationId, lineId, source: 'web_app' })).status).toBe(200)
        setSystemTime(now)

        const response = await appRequestWithRedirect(`/insights/lines/${encodeURIComponent(lineName)}`)

        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')

        const responseBody = await response.json()
        expect(responseBody).toMatchObject({
            line: { name: lineName, variantCount: lineVariantCount },
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

    it('expires the CDN cache at the next city-local midnight', async () => {
        setSystemTime(new Date('2026-07-13T21:59:30.000Z'))

        const response = await appRequestWithRedirect(`/insights/lines/${encodeURIComponent(lineName)}`)

        expect(response.status).toBe(200)
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('public, max-age=30')
    })

    it('combines reports from every internal variant of a public line', async () => {
        setSystemTime(new Date('2026-07-13T09:00:00.000Z'))
        for (const [index, variantLineId] of variantLineIds.entries()) {
            expect(
                (
                    await sendReportRequest({
                        stationId: variantStationIds[index]!,
                        lineId: variantLineId,
                        source: 'web_app',
                    })
                ).status
            ).toBe(200)
        }

        const response = await appRequestWithRedirect(`/insights/lines/${encodeURIComponent(multiVariantLineName)}`)

        expect(response.status).toBe(200)
        const responseBody = lineInsightsSchema.parse(await response.json())
        expect(responseBody.line).toEqual({
            name: multiVariantLineName,
            variantCount: variantLineIds.length,
        })
        expect(responseBody.hotspots.stations.reduce((sum, station) => sum + station.value, 0)).toBe(
            variantLineIds.length
        )
    })

    it('batches distinct line names with the same payloads as individual requests', async () => {
        setSystemTime(new Date('2026-07-13T09:00:00.000Z'))
        for (const [index, variantLineId] of variantLineIds.entries()) {
            expect(
                (
                    await sendReportRequest({
                        stationId: variantStationIds[index]!,
                        lineId: variantLineId,
                        source: 'web_app',
                    })
                ).status
            ).toBe(200)
        }
        const names = [...new Set([lineName, multiVariantLineName])]
        const response = await appRequestWithRedirect(
            `/insights/lines?names=${encodeURIComponent([...names, names[0]].join(','))}`
        )
        expect(response.status).toBe(200)
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('public, max-age=46800')
        const batch = await response.json()
        const individual = await Promise.all(
            names.map(async (name) => {
                const response = await appRequestWithRedirect(`/insights/lines/${encodeURIComponent(name)}`)
                return response.json()
            })
        )
        expect(batch).toEqual(individual)
    })

    it.each(['', '?names=', '?names=UNKNOWN_LINE', '?names=' + Array(51).fill('U8').join(',')])(
        'rejects invalid batches: %s',
        async (query) => {
            const response = await appRequestWithRedirect(`/insights/lines${query}`)
            expect(response.status).toBe(query.includes('UNKNOWN_LINE') ? 404 : 400)
            expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBeNull()
        }
    )

    it('preserves city-local weekdays, repeated DST hours, and the exact oldest timestamp', async () => {
        const timestamps = [
            '2026-10-24T21:59:59.000Z',
            '2026-10-24T22:00:01.000Z',
            '2026-10-25T00:05:00.000Z',
            '2026-10-25T00:06:00.000Z',
            '2026-10-25T01:05:00.000Z',
        ]
        for (const timestamp of timestamps) await sendReportAt(new Date(timestamp))
        setSystemTime(new Date('2026-10-25T12:00:00.000Z'))
        const response = await appRequestWithRedirect(`/insights/lines?names=${encodeURIComponent(lineName)}`)
        const [insight] = lineInsightsSchema.array().parse(await response.json())
        expect(insight.profile.source).toBe('city_reports')
        expect(insight.profile.metric.range.start).toBe(timestamps[0])
        expect(insight.profile.weekday).toBe(7)
        expect(insight.profile.hours.filter((hour: { value: number }) => hour.value > 0)).toEqual([
            { hour: 0, value: 1 },
            { hour: 2, value: 3 },
        ])
        expect(insight.hotspots.stations).toEqual([])
    })

    it('retains the line-specific threshold and excludes other weekdays and city reports', async () => {
        const first = new Date('2026-01-05T12:00:00.000Z')
        for (let week = 0; week < 24; week++) {
            setSystemTime(new Date(first.getTime() + week * 7 * 86400000))
            for (let report = 0; report < 4; report++) {
                expect((await sendReportRequest({ stationId, lineId, source: 'web_app' })).status).toBe(200)
            }
        }
        await sendReportAt(new Date('2026-06-22T08:00:00.000Z'))
        setSystemTime(new Date('2026-06-23T08:00:00.000Z'))
        expect((await sendReportRequest({ stationId, lineId, source: 'web_app' })).status).toBe(200)
        setSystemTime(new Date('2026-06-29T12:00:00.000Z'))
        const response = await appRequestWithRedirect(`/insights/lines?names=${encodeURIComponent(lineName)}`)
        const [insight] = lineInsightsSchema.array().parse(await response.json())
        expect(insight.profile.source).toBe('line_reports')
        expect(insight.profile.metric.range.start).toBe(first.toISOString())
        expect(insight.profile.hours.reduce((sum: number, hour: { value: number }) => sum + hour.value, 0)).toBe(96)
        expect(insight.hotspots.stations).toEqual([{ stationId, name: expect.any(String), value: 97, share: 1 }])
    })

    it('returns the standard line-not-found error', async () => {
        const response = await appRequestWithRedirect('/insights/lines/UNKNOWN_LINE')

        expect(response.status).toBe(404)
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBeNull()
        await expect(response.json()).resolves.toMatchObject({ details: { internal_code: 'LINE_NOT_FOUND' } })
    })
})
