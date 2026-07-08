import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { asc, eq, inArray } from 'drizzle-orm'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { app } from '../src/index'
import { referenceCacheKey } from '../src/modules/transit/reference-cache'
import { TRANSIT_CACHE_CONTROL, transitCacheTag } from '../src/modules/transit/transit-cache-middleware'
import { db, lines, lineStations, stations } from './test-db'
import { appRequestWithRedirect, testEnv } from './test-utils'

type DistanceResponse = {
    distance: number
}

type ErrorResponse = {
    details: {
        internal_code: string
    }
}

// The Workers pool provides a real caches.default (the DOM CacheStorage type lacks it).
const cache = (
    caches as unknown as {
        default: {
            match(request: Request): Promise<Response | undefined>
            put(request: Request, response: Response): Promise<void>
            delete(request: Request): Promise<boolean>
        }
    }
).default

const graphKey = (): Request => new Request(referenceCacheKey('berlin', 'graph-inputs'))

const TEST_STATION_IDS = ['GRAPH_A', 'GRAPH_B'] as const
const TEST_LINE_ID = 'GRAPH_L1'

// Two adjacent stations on one seeded line — the warm-up request that populates the cache.
let fromStationId: string
let toStationId: string

// Real request through the whole app with a real ExecutionContext, so cachedReference's
// waitUntil(cache.put) runs and is awaited before the test goes on.
const distanceRequest = async (from: string, to: string) => {
    const ctx = createExecutionContext()
    const params = new URLSearchParams({ from, to })
    const response = await app.request(
        `https://api.test/v0/transit/distance?${params.toString()}`,
        undefined,
        testEnv(),
        ctx
    )
    await waitOnExecutionContext(ctx)
    return response
}

// Stations that exist in D1 but not in a previously warmed graph entry — the observable
// that tells a cache hit (404, D1 not re-read) apart from a fresh load (200).
const insertStationsUnknownToTheCachedGraph = async () => {
    await db.insert(stations).values([
        { id: 'GRAPH_A', name: 'Graph A', lat: 52.5, lng: 13.4 },
        { id: 'GRAPH_B', name: 'Graph B', lat: 52.51, lng: 13.41 },
    ])
    await db.insert(lines).values({ id: TEST_LINE_ID, name: 'Graph Line 1', type: 'subway', isCircular: false })
    await db.insert(lineStations).values([
        { lineId: TEST_LINE_ID, stationId: 'GRAPH_A', order: 0 },
        { lineId: TEST_LINE_ID, stationId: 'GRAPH_B', order: 1 },
    ])
}

describe('GET /v0/transit/distance graph caching (real Cache API)', () => {
    beforeAll(async () => {
        const rows = await db
            .select({
                lineId: lineStations.lineId,
                stationId: lineStations.stationId,
            })
            .from(lineStations)
            .orderBy(asc(lineStations.lineId), asc(lineStations.order))

        for (let i = 0; i < rows.length - 1; i++) {
            if (rows[i].lineId === rows[i + 1].lineId) {
                fromStationId = rows[i].stationId
                toStationId = rows[i + 1].stationId
                return
            }
        }

        throw new Error('Expected seeded transit data to contain two consecutive stations on one line')
    })

    // Storage is shared across suites (isolatedStorage: false); drop the warmed graph entry
    // and the fabricated topology so no other suite reads this file's state.
    afterEach(async () => {
        await cache.delete(graphKey())
        await db.delete(lines).where(eq(lines.id, TEST_LINE_ID))
        await db.delete(stations).where(inArray(stations.id, [...TEST_STATION_IDS]))
    })

    it('warms a graph-inputs entry with the city Cache-Tag while the response itself stays no-store', async () => {
        const response = await distanceRequest(fromStationId, toStationId)

        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('no-store')

        const entry = await cache.match(graphKey())
        expect(entry).toBeDefined()
        expect(entry!.headers.get('Cache-Tag')).toBe(transitCacheTag('berlin'))
        expect(entry!.headers.get('Cache-Control')).toBe(TRANSIT_CACHE_CONTROL)
    })

    it('serves later requests from the cached graph without re-reading D1', async () => {
        const warm = await distanceRequest(fromStationId, toStationId)
        expect(warm.status).toBe(200)
        const warmBody = (await warm.json()) as DistanceResponse

        await insertStationsUnknownToTheCachedGraph()

        // The new stations are in D1 but not in the cached graph: a 404 proves the graph
        // was rebuilt from the cache entry, not from a fresh table scan.
        const staleRead = await distanceRequest('GRAPH_A', 'GRAPH_B')
        expect(staleRead.status).toBe(404)
        const staleBody = (await staleRead.json()) as ErrorResponse
        expect(staleBody.details.internal_code).toBe('STATION_NOT_FOUND')

        // And the cached JSON round-trips into a working graph for the seeded stations.
        const cachedHit = await distanceRequest(fromStationId, toStationId)
        expect(cachedHit.status).toBe(200)
        expect(((await cachedHit.json()) as DistanceResponse).distance).toBe(warmBody.distance)
    })

    it('reads fresh data from D1 after a purge and re-warms the entry', async () => {
        await distanceRequest(fromStationId, toStationId)
        await insertStationsUnknownToTheCachedGraph()

        // Local analogue of the production reseed tag purge (the Cloudflare API call itself
        // is covered in city-cache.test.ts): drop the entry, the next request must miss.
        expect(await cache.delete(graphKey())).toBe(true)

        const afterPurge = await distanceRequest('GRAPH_A', 'GRAPH_B')
        expect(afterPurge.status).toBe(200)
        expect(((await afterPurge.json()) as DistanceResponse).distance).toBe(1)

        expect(await cache.match(graphKey())).toBeDefined()
    })

    it('skips the cache write without an ExecutionContext, matching the Bun/seed-CLI fallback', async () => {
        const params = new URLSearchParams({ from: fromStationId, to: toStationId })
        const response = await appRequestWithRedirect(`/transit/distance?${params.toString()}`)

        expect(response.status).toBe(200)
        expect(await cache.match(graphKey())).toBeUndefined()
    })
})
