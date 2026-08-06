import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import {
    REPORTS_CACHE_CONTROL,
    REPORTS_EDGE_TTL_SECONDS,
    stationReportsCacheKey,
    stationReportsCacheTag,
} from '../src/modules/reports/reports-cache-middleware'
import { db, lineStations, lines } from './test-db'
import { appRequestWithRedirect, resetTestEnv, sendReportRequest, setSystemTime } from './test-utils'

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

// The app builds this URL from its own origin; tests reach the worker on localhost.
const REQUEST_URL = new URL('http://localhost/v0/reports')
const FROZEN_NOW = new Date('2026-08-06T12:34:56.000Z')

let stationA: string
let stationB: string

// Storage is shared across suites (isolatedStorage: false), so every key this file seeds is
// removed again rather than left for another suite to read.
const seededKeys: Request[] = []

const seedCacheEntry = async (stationId: string): Promise<Request> => {
    const key = new Request(stationReportsCacheKey(REQUEST_URL, 'berlin', stationId, FROZEN_NOW.getTime()).toString())
    seededKeys.push(key)
    await cache.put(
        key,
        new Response('[]', {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${REPORTS_EDGE_TTL_SECONDS}`,
            },
        })
    )
    return key
}

beforeAll(async () => {
    const [line] = await db.select({ id: lines.id }).from(lines).limit(1)
    const stationsOnLine = await db
        .select({ id: lineStations.stationId })
        .from(lineStations)
        .where(eq(lineStations.lineId, line!.id))
        .limit(2)

    stationA = stationsOnLine[0]!.id
    stationB = stationsOnLine[1]!.id
})

afterEach(async () => {
    setSystemTime()
    for (const key of seededKeys.splice(0)) {
        await cache.delete(key)
    }
})

afterAll(() => {
    resetTestEnv()
})

describe('station reports cache headers', () => {
    it('marks a station response cacheable at the edge while keeping browsers revalidating', async () => {
        const response = await appRequestWithRedirect(`/reports/${stationA}`)

        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe(REPORTS_CACHE_CONTROL)
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe(`public, max-age=${REPORTS_EDGE_TTL_SECONDS}`)
        expect(response.headers.get('Cache-Tag')).toBe(stationReportsCacheTag('berlin', stationA))
    })

    it('leaves the unscoped reports list uncached', async () => {
        const response = await appRequestWithRedirect('/reports')

        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBeNull()
    })

    it('does not cache a rejected time range', async () => {
        const response = await appRequestWithRedirect(
            `/reports/${stationA}?from=2026-01-01T00:00:00.000Z&to=2026-06-01T00:00:00.000Z`
        )

        expect(response.status).toBeGreaterThanOrEqual(400)
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBeNull()
    })
})

describe('station reports cache invalidation', () => {
    it('drops the cached entry for the station a new report was filed at', async () => {
        setSystemTime(FROZEN_NOW)
        const key = await seedCacheEntry(stationA)
        expect(await cache.match(key)).toBeDefined()

        expect((await sendReportRequest({ stationId: stationA, source: 'telegram' })).status).toBe(200)

        expect(await cache.match(key)).toBeUndefined()
    })

    it('leaves other stations cached', async () => {
        setSystemTime(FROZEN_NOW)
        const keyA = await seedCacheEntry(stationA)
        const keyB = await seedCacheEntry(stationB)

        expect((await sendReportRequest({ stationId: stationA, source: 'telegram' })).status).toBe(200)

        expect(await cache.match(keyA)).toBeUndefined()
        expect(await cache.match(keyB)).toBeDefined()
    })
})
