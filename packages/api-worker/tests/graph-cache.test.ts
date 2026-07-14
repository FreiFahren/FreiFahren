import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { asc } from 'drizzle-orm'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { app } from '../src/index'
import { REFERENCE_CACHE_CONTROL, referenceCacheKey } from '../src/modules/transit/reference-cache'
import { transitCacheTag } from '../src/modules/transit/transit-cache-middleware'
import { db, lineStations } from './test-db'
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

// A fabricated graph-inputs entry whose stations exist nowhere in D1, written through the
// same Cache API the service reads. Answering a distance between them is only possible
// from this entry, which makes cache hits observable without any manual DB writes; the
// body mirrors the GraphInputs row shape the service stores.
const putSyntheticGraphEntry = async () => {
    const inputs = {
        stations: [
            { id: 'FAKE_A', name: 'Fake A', lat: 52.5, lng: 13.4 },
            { id: 'FAKE_B', name: 'Fake B', lat: 52.51, lng: 13.41 },
        ],
        lines: [{ id: 'FAKE_L1', name: 'Fake Line 1', type: 'subway', isCircular: false, color: '#000000' }],
        lineStations: [
            { lineId: 'FAKE_L1', stationId: 'FAKE_A', order: 0 },
            { lineId: 'FAKE_L1', stationId: 'FAKE_B', order: 1 },
        ],
    }
    await cache.put(
        graphKey(),
        new Response(JSON.stringify(inputs), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': REFERENCE_CACHE_CONTROL,
                'Cache-Tag': transitCacheTag('berlin'),
            },
        })
    )
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
    // so no other suite reads this file's cache state.
    afterEach(async () => {
        await cache.delete(graphKey())
    })

    it('warms a graph-inputs entry with the city Cache-Tag while the response itself stays no-store', async () => {
        const response = await distanceRequest(fromStationId, toStationId)

        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('no-store')

        const entry = await cache.match(graphKey())
        expect(entry).toBeDefined()
        expect(entry!.headers.get('Cache-Tag')).toBe(transitCacheTag('berlin'))
        expect(entry!.headers.get('Cache-Control')).toBe(REFERENCE_CACHE_CONTROL)
    })

    it('serves requests from the cached graph without re-reading D1', async () => {
        await putSyntheticGraphEntry()

        // The fabricated stations exist only in the cache entry: a 200 proves the graph
        // was rebuilt from the cached JSON, not from a fresh D1 table scan.
        const cachedHit = await distanceRequest('FAKE_A', 'FAKE_B')
        expect(cachedHit.status).toBe(200)
        expect(((await cachedHit.json()) as DistanceResponse).distance).toBe(1)

        // And the seeded stations, present in D1 but absent from the cached graph, are
        // not found — D1 was never consulted.
        const seededMiss = await distanceRequest(fromStationId, toStationId)
        expect(seededMiss.status).toBe(404)
        expect(((await seededMiss.json()) as ErrorResponse).details.internal_code).toBe('STATION_NOT_FOUND')
    })

    it('reads fresh data from D1 after a purge and re-warms the entry', async () => {
        await putSyntheticGraphEntry()
        expect((await distanceRequest('FAKE_A', 'FAKE_B')).status).toBe(200)

        // Local analogue of the production reseed tag purge (the Cloudflare API call itself
        // is covered in city-cache.test.ts): drop the entry, the next request must miss.
        expect(await cache.delete(graphKey())).toBe(true)

        const afterPurge = await distanceRequest('FAKE_A', 'FAKE_B')
        expect(afterPurge.status).toBe(404)
        expect(((await afterPurge.json()) as ErrorResponse).details.internal_code).toBe('STATION_NOT_FOUND')

        // The miss re-read D1 and re-warmed the entry with the real seeded topology.
        expect(await cache.match(graphKey())).toBeDefined()
        const seededHit = await distanceRequest(fromStationId, toStationId)
        expect(seededHit.status).toBe(200)
        expect(((await seededHit.json()) as DistanceResponse).distance).toBe(1)
    })

    it('skips the cache write without an ExecutionContext, matching the Bun/seed-CLI fallback', async () => {
        const params = new URLSearchParams({ from: fromStationId, to: toStationId })
        const response = await appRequestWithRedirect(`/transit/distance?${params.toString()}`)

        expect(response.status).toBe(200)
        expect(await cache.match(graphKey())).toBeUndefined()
    })
})
