import { and, asc, eq, inArray } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../src'
import { db, lines, lineStations, reports, segments, stations } from './test-db'
import { appRequestWithRedirect, resetTestEnv, sendReportRequest } from './test-utils'

type RouteSegment = {
    segmentId: number | null
    fromStationId: string
    toStationId: string
    offsetSeconds: number
    risk: number | null
}

type RouteResponse = {
    legs: {
        lineId: string
        lineName: string
        stationIds: string[]
        departureOffsetSeconds: number
        arrivalOffsetSeconds: number
        segments: RouteSegment[]
    }[]
    totalSeconds: number
    stationCount: number
    transfers: number
    risk: { overall: number; worstSegmentId: number | null; unratedSegments: number }
}

type ErrorResponse = { details: { internal_code: string } }

let lineId: string
let stationIds: string[]
let routeApp = createApp()

const getRoute = (from: string, to: string) =>
    appRequestWithRedirect(`/transit/route?${new URLSearchParams({ from, to }).toString()}`, undefined, routeApp)

const routeBody = async (from: string, to: string): Promise<RouteResponse> => {
    const response = await getRoute(from, to)
    expect(response.status).toBe(200)
    return (await response.json()) as RouteResponse
}

const allSegments = (body: RouteResponse): RouteSegment[] => body.legs.flatMap((leg) => leg.segments)

describe('GET /v0/transit/route', () => {
    beforeAll(async () => {
        // Find six consecutive stations on one line in the seeded data rather than naming
        // stations, so the test does not depend on a particular city's network.
        const rows = await db
            .select({ lineId: lineStations.lineId, stationId: lineStations.stationId })
            .from(lineStations)
            .orderBy(asc(lineStations.lineId), asc(lineStations.order))

        for (let index = 0; index + 5 < rows.length; index++) {
            const window = rows.slice(index, index + 6)
            if (window.every((row) => row.lineId === window[0].lineId)) {
                lineId = window[0].lineId
                stationIds = window.map((row) => row.stationId)
                return
            }
        }

        throw new Error('Expected seeded transit data to contain six consecutive stations on one line')
    })

    beforeEach(async () => {
        routeApp = createApp()
        await db.delete(reports)
    })

    afterEach(async () => {
        resetTestEnv()
        await db.delete(reports)
    })

    it('returns a single leg for a ride along one line', async () => {
        const body = await routeBody(stationIds[0], stationIds[3])

        expect(body.legs).toHaveLength(1)
        expect(body.legs[0].lineId).toBe(lineId)
        expect(body.legs[0].stationIds).toEqual(stationIds.slice(0, 4))
        expect(body.transfers).toBe(0)
        expect(body.stationCount).toBe(3)
        expect(body.totalSeconds).toBeGreaterThan(0)
    })

    it('increases the offset of every following segment', async () => {
        const offsets = allSegments(await routeBody(stationIds[0], stationIds[3])).map(
            (segment) => segment.offsetSeconds
        )

        expect(offsets[0]).toBe(0)
        expect(offsets).toEqual([...offsets].sort((a, b) => a - b))
        expect(new Set(offsets).size).toBe(offsets.length)
    })

    it('resolves segments when travelling against the seeded direction', async () => {
        const body = await routeBody(stationIds[3], stationIds[0])

        expect(body.risk.unratedSegments).toBe(0)
        expect(allSegments(body).every((segment) => segment.segmentId !== null)).toBe(true)
    })

    it('reports no risk while there are no reports', async () => {
        const body = await routeBody(stationIds[0], stationIds[3])

        expect(body.risk.overall).toBe(0)
        expect(body.risk.worstSegmentId).toBeNull()
        // A risk-free leg is scored, not omitted: null would mean "could not determine".
        expect(allSegments(body).every((segment) => segment.risk === 0)).toBe(true)
    })

    it('raises the risk of a segment a report was filed on', async () => {
        await sendReportRequest({ stationId: stationIds[1], lineId, source: 'web_app' }, routeApp)

        const body = await routeBody(stationIds[0], stationIds[3])

        expect(body.risk.overall).toBeGreaterThan(0)
        expect(body.risk.worstSegmentId).not.toBeNull()
    })

    it('rejects a request without parameters', async () => {
        const response = await appRequestWithRedirect('/transit/route', undefined, routeApp)

        expect(response.status).toBe(400)
    })

    it('rejects identical origin and destination', async () => {
        const response = await getRoute(stationIds[0], stationIds[0])

        expect(response.status).toBe(400)
    })

    it('returns 404 when a station id does not exist', async () => {
        const response = await getRoute('UNKNOWN_STATION', stationIds[0])

        expect(response.status).toBe(404)
        expect(((await response.json()) as ErrorResponse).details.internal_code).toBe('STATION_NOT_FOUND')
    })

    it('is not stored at the edge', async () => {
        // Guards against the route being added to the cacheable transit paths: the answer
        // depends on the viewer and on the current time.
        const response = await getRoute(stationIds[0], stationIds[2])

        expect(response.headers.get('Cache-Control')).toBe('no-store')
    })
})

/*
 * The seeded network offers alternative lines between most station pairs, so two
 * journeys over "the same" stretch can legitimately come back on different lines and
 * share no segments at all. This isolated line has no alternatives, which is what makes
 * arrival time the only difference between the two journeys below.
 */
describe('GET /v0/transit/route — risk over time', () => {
    const LINE_ID = 'TEST_TL'
    const STATION_IDS = Array.from({ length: 8 }, (_, index) => `TEST_T${index}`)

    let isolatedApp = createApp()

    beforeEach(async () => {
        await db.insert(stations).values(
            STATION_IDS.map((id, index) => ({
                id,
                name: `Timing Test ${index}`,
                lat: 52.9 + index * 0.01,
                lng: 13.9,
            }))
        )
        await db.insert(lines).values({ id: LINE_ID, name: 'Timing Test Line', type: 'subway', isCircular: false })
        await db
            .insert(lineStations)
            .values(STATION_IDS.map((stationId, order) => ({ lineId: LINE_ID, stationId, order })))
        await db.insert(segments).values(
            STATION_IDS.slice(0, -1).map((fromStationId, position) => ({
                lineId: LINE_ID,
                fromStationId,
                toStationId: STATION_IDS[position + 1],
                position,
                color: '#123456',
                coordinates: [
                    [13.9, 52.9 + position * 0.01],
                    [13.9, 52.9 + (position + 1) * 0.01],
                ] as [number, number][],
            }))
        )
        // Built after the fixture so its reference reads see the isolated line.
        isolatedApp = createApp()
        await db.delete(reports)
    })

    afterEach(async () => {
        resetTestEnv()
        await db.delete(reports)
        await db.delete(segments).where(eq(segments.lineId, LINE_ID))
        await db.delete(lineStations).where(eq(lineStations.lineId, LINE_ID))
        await db.delete(lines).where(eq(lines.id, LINE_ID))
        await db.delete(stations).where(inArray(stations.id, STATION_IDS))
    })

    const isolatedRoute = async (from: string, to: string): Promise<RouteResponse> => {
        const response = await appRequestWithRedirect(
            `/transit/route?${new URLSearchParams({ from, to }).toString()}`,
            undefined,
            isolatedApp
        )
        expect(response.status).toBe(200)
        return (await response.json()) as RouteResponse
    }

    it('reports a hop with no segment as unrated rather than risk-free', async () => {
        // line_stations and segments are separate tables, so a hop can exist with no
        // segment behind it. Reporting that as 0 would present an unscored stretch as
        // safe, which is the one failure this feature must not have.
        await db.delete(segments).where(and(eq(segments.lineId, LINE_ID), eq(segments.fromStationId, 'TEST_T1')))
        isolatedApp = createApp()

        const body = await isolatedRoute('TEST_T0', 'TEST_T3')
        const gap = allSegments(body).find((segment) => segment.fromStationId === 'TEST_T1')

        expect(gap?.segmentId).toBeNull()
        expect(gap?.risk).toBeNull()
        expect(body.risk.unratedSegments).toBe(1)
    })

    it('scores the same segment lower when it is reached later in the journey', async () => {
        // Reported at the far end of the line, so the shared segments sit far enough away
        // spatially that their risk stays below the model's cap — a saturated 1.0 cannot
        // show a difference no matter how much later it is reached.
        await sendReportRequest({ stationId: 'TEST_T7', lineId: LINE_ID, source: 'web_app' }, isolatedApp)

        // Same destination, same line, same report: only the time to reach the shared
        // segments differs, so temporal decay is the sole cause of any difference.
        const nearby = await isolatedRoute('TEST_T4', 'TEST_T6')
        const distant = await isolatedRoute('TEST_T0', 'TEST_T6')

        const nearbyById = new Map(allSegments(nearby).map((segment) => [segment.segmentId, segment]))
        const comparable = allSegments(distant).filter((segment) => {
            const sooner = nearbyById.get(segment.segmentId)
            return sooner !== undefined && sooner.risk !== null && sooner.risk > 0 && sooner.risk < 1
        })

        expect(comparable).not.toHaveLength(0)

        for (const segment of comparable) {
            const sooner = nearbyById.get(segment.segmentId)!
            expect(segment.offsetSeconds).toBeGreaterThan(sooner.offsetSeconds)
            expect(segment.risk!).toBeLessThan(sooner.risk!)
        }
    })
})
