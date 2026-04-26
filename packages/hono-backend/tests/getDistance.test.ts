import { afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { asc, eq, inArray } from 'drizzle-orm'

import { db, lines, lineStations, stations } from '../src/db'
import { app, createApp } from '../src/index'
import { appRequestWithRedirect } from './test-utils'

type DistanceResponse = {
    distance: number
}

type ErrorResponse = {
    details: {
        internal_code: string
        description?: string
    }
}

const ISOLATED_STATION_ID = 'TEST_ISOLATED'
const TRANSFER_STATION_IDS = ['TEST_A', 'TEST_B', 'TEST_C'] as const
const TRANSFER_LINE_IDS = ['TEST_L1', 'TEST_L2'] as const

let fromStationId: string
let toStationId: string
let twoHopsAwayStationId: string

const getDistance = (from: string, to: string, targetApp = app) => {
    const params = new URLSearchParams({ from, to })
    return appRequestWithRedirect(`/transit/distance?${params.toString()}`, undefined, targetApp)
}

describe('GET /v0/transit/distance', () => {
    beforeAll(async () => {
        const rows = await db
            .select({
                lineId: lineStations.lineId,
                stationId: lineStations.stationId,
            })
            .from(lineStations)
            .orderBy(asc(lineStations.lineId), asc(lineStations.order))

        for (let i = 0; i < rows.length - 3; i++) {
            if (
                rows[i].lineId === rows[i + 1].lineId &&
                rows[i].lineId === rows[i + 2].lineId &&
                rows[i].lineId === rows[i + 3].lineId
            ) {
                fromStationId = rows[i + 1].stationId
                toStationId = rows[i + 2].stationId
                twoHopsAwayStationId = rows[i + 3].stationId
                return
            }
        }

        throw new Error('Expected seeded transit data to contain at least four consecutive stations on one line')
    })

    afterEach(async () => {
        await db.delete(lines).where(inArray(lines.id, [...TRANSFER_LINE_IDS]))
        await db.delete(stations).where(inArray(stations.id, [...TRANSFER_STATION_IDS]))
        await db.delete(stations).where(eq(stations.id, ISOLATED_STATION_ID))
    })

    it('returns the shortest distance between two adjacent stations', async () => {
        const response = await getDistance(fromStationId, toStationId)

        expect(response.status).toBe(200)

        const body = (await response.json()) as DistanceResponse
        expect(body.distance).toBe(1)
    })

    it('returns the same distance in both directions', async () => {
        const forwardResponse = await getDistance(fromStationId, twoHopsAwayStationId)
        const reverseResponse = await getDistance(twoHopsAwayStationId, fromStationId)

        expect(forwardResponse.status).toBe(200)
        expect(reverseResponse.status).toBe(200)

        const forwardBody = (await forwardResponse.json()) as DistanceResponse
        const reverseBody = (await reverseResponse.json()) as DistanceResponse
        expect(reverseBody.distance).toBe(forwardBody.distance)
    })

    it('returns 2 for stations two hops apart on the same line', async () => {
        const response = await getDistance(fromStationId, twoHopsAwayStationId)

        expect(response.status).toBe(200)

        const body = (await response.json()) as DistanceResponse
        expect(body.distance).toBe(2)
    })

    it('counts station hops without adding a line switch penalty', async () => {
        await db.insert(stations).values([
            { id: 'TEST_A', name: 'Test A', lat: 52.5, lng: 13.4 },
            { id: 'TEST_B', name: 'Test B', lat: 52.51, lng: 13.41 },
            { id: 'TEST_C', name: 'Test C', lat: 52.52, lng: 13.42 },
        ])
        await db.insert(lines).values([
            { id: 'TEST_L1', name: 'Test Line 1', isCircular: false },
            { id: 'TEST_L2', name: 'Test Line 2', isCircular: false },
        ])
        await db.insert(lineStations).values([
            { lineId: 'TEST_L1', stationId: 'TEST_A', order: 0 },
            { lineId: 'TEST_L1', stationId: 'TEST_B', order: 1 },
            { lineId: 'TEST_L2', stationId: 'TEST_B', order: 0 },
            { lineId: 'TEST_L2', stationId: 'TEST_C', order: 1 },
        ])

        const transferApp = createApp(db)
        const response = await getDistance('TEST_A', 'TEST_C', transferApp)

        expect(response.status).toBe(200)

        const body = (await response.json()) as DistanceResponse
        expect(body.distance).toBe(2)
    })

    it('returns 0 when both ids refer to the same existing station', async () => {
        const response = await getDistance(fromStationId, fromStationId)

        expect(response.status).toBe(200)

        const body = (await response.json()) as DistanceResponse
        expect(body.distance).toBe(0)
    })

    it('rejects requests with missing station ids', async () => {
        const response = await appRequestWithRedirect('/transit/distance')

        expect(response.status).toBe(400)
    })

    it('returns 404 when a station id does not exist', async () => {
        const response = await getDistance('UNKNOWN_STATION', toStationId)

        expect(response.status).toBe(404)

        const body = (await response.json()) as ErrorResponse
        expect(body.details.internal_code).toBe('STATION_NOT_FOUND')
    })

    it('returns 422 when no path exists between stations', async () => {
        await db.insert(stations).values({
            id: ISOLATED_STATION_ID,
            name: 'Isolated Test Station',
            lat: 52.52,
            lng: 13.405,
        })

        const isolatedApp = createApp(db)
        const response = await getDistance(fromStationId, ISOLATED_STATION_ID, isolatedApp)

        expect(response.status).toBe(422)

        const body = (await response.json()) as ErrorResponse
        expect(body.details.internal_code).toBe('NO_PATH_FOUND')
    })
})
