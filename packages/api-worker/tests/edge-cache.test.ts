import { getCity } from '@freifahren/cities'
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { Hono } from 'hono'
import { afterAll, afterEach, describe, expect, it } from 'vitest'

import type { Env } from '../src/app-env'
import { app } from '../src/index'
import { referenceCacheKey } from '../src/modules/transit/reference-cache'
import {
    cityCacheKey,
    TRANSIT_CACHE_CONTROL,
    transitCacheMiddleware,
    transitCacheTag,
    transitEdgeCacheMiddleware,
} from '../src/modules/transit/transit-cache-middleware'
import { testEnv } from './test-utils'

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

const BASE = 'https://api.test'

// Storage is shared across suites (isolatedStorage: false), so every entry a test warms is
// tracked and deleted again — no other suite may observe this file's cache state.
const warmedUrls: string[] = []

const keyFor = (url: string): Request => {
    warmedUrls.push(url)
    return cityCacheKey(url, 'berlin')
}

// Real request through the whole app with a real ExecutionContext, so c.executionCtx exists and
// waitOnExecutionContext genuinely awaits the waitUntil(cache.put) before the test goes on.
const edgeRequest = async (url: string, headers: Record<string, string> = {}) => {
    warmedUrls.push(url)
    const ctx = createExecutionContext()
    const response = await app.request(url, { headers }, testEnv(), ctx)
    await waitOnExecutionContext(ctx)
    return response
}

afterEach(async () => {
    for (const url of warmedUrls.splice(0)) {
        await cache.delete(cityCacheKey(url, 'berlin'))
    }
})

// Requests with a real ExecutionContext also warm the internal reference cache
// (cachedReference); drop those entries so later suites keep reading straight from D1.
afterAll(async () => {
    for (const key of ['stations', 'lines', 'segments']) {
        await cache.delete(new Request(referenceCacheKey('berlin', key)))
    }
})

describe('transitEdgeCacheMiddleware (real Cache API)', () => {
    it('serves the second request from the edge cache', async () => {
        const url = `${BASE}/v0/transit/lines?t=hit`

        const miss = await edgeRequest(url)
        expect(miss.status).toBe(200)
        expect(miss.headers.get('X-Edge-Cache')).toBe('MISS')

        const hit = await edgeRequest(url)
        expect(hit.status).toBe(200)
        expect(hit.headers.get('X-Edge-Cache')).toBe('HIT')
        expect(await hit.json()).toEqual(await miss.json())
    })

    it('stores the entry under the city-scoped key with the Cache-Tag the tag purge targets', async () => {
        const url = `${BASE}/v0/transit/stations?t=tag`
        await edgeRequest(url)

        const entry = await cache.match(keyFor(url))
        expect(entry).toBeDefined()
        expect(entry!.headers.get('Cache-Tag')).toBe(transitCacheTag('berlin'))
        expect(entry!.headers.get('Cache-Control')).toBe(TRANSIT_CACHE_CONTROL)
        expect(entry!.headers.get('ETag')).not.toBeNull()
    })

    it('strips origin-specific headers from the stored entry and re-derives CORS per request', async () => {
        const url = `${BASE}/v0/transit/lines?t=cors`

        const first = await edgeRequest(url, { Origin: 'http://localhost' })
        expect(first.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost')

        const entry = await cache.match(keyFor(url))
        expect(entry).toBeDefined()
        expect(entry!.headers.get('Access-Control-Allow-Origin')).toBeNull()
        expect(entry!.headers.get('Access-Control-Allow-Credentials')).toBeNull()
        expect(entry!.headers.get('Vary')).toBeNull()

        // A hit from another origin must get its own CORS headers, not the first origin's.
        const otherOrigin = await edgeRequest(url, { Origin: 'http://127.0.0.1:1871' })
        expect(otherOrigin.headers.get('X-Edge-Cache')).toBe('HIT')
        expect(otherOrigin.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:1871')
    })

    it('answers If-None-Match on a warm entry with a 304 preserving ETag and Cache-Control', async () => {
        const url = `${BASE}/v0/transit/segments?t=etag`

        const miss = await edgeRequest(url)
        const etag = miss.headers.get('ETag')
        expect(etag).not.toBeNull()

        const revalidated = await edgeRequest(url, { 'If-None-Match': etag! })
        expect(revalidated.status).toBe(304)
        expect(revalidated.headers.get('X-Edge-Cache')).toBe('HIT')
        expect(revalidated.headers.get('ETag')).toBe(etag)
        expect(revalidated.headers.get('Cache-Control')).toBe(TRANSIT_CACHE_CONTROL)
        expect(await revalidated.text()).toBe('')

        // Weak comparison: a W/-prefixed client tag and a bare * both revalidate.
        const weak = await edgeRequest(url, { 'If-None-Match': `W/${etag!}` })
        expect(weak.status).toBe(304)
        const star = await edgeRequest(url, { 'If-None-Match': '*' })
        expect(star.status).toBe(304)

        // A stale tag (post-reseed ETag change) must get the full body again, not a 304.
        const stale = await edgeRequest(url, { 'If-None-Match': '"no-longer-current"' })
        expect(stale.status).toBe(200)
        expect(stale.headers.get('X-Edge-Cache')).toBe('HIT')
    })

    it('does not cache a non-200: an origin 304 on a cold cache stays uncached', async () => {
        const url = `${BASE}/v0/transit/lines?t=cold304`

        const miss = await edgeRequest(url)
        const etag = miss.headers.get('ETag')
        expect(etag).not.toBeNull()
        await cache.delete(cityCacheKey(url, 'berlin'))

        // Cold cache + matching If-None-Match: the origin's etag middleware answers 304, which
        // the edge middleware must pass through without storing.
        const coldRevalidation = await edgeRequest(url, { 'If-None-Match': etag! })
        expect(coldRevalidation.status).toBe(304)
        expect(coldRevalidation.headers.get('X-Edge-Cache')).toBeNull()
        expect(await cache.match(cityCacheKey(url, 'berlin'))).toBeUndefined()
    })

    it('misses after a purge (key delete) and repopulates the entry', async () => {
        const url = `${BASE}/v0/transit/stations?t=purge`

        await edgeRequest(url)
        expect((await edgeRequest(url)).headers.get('X-Edge-Cache')).toBe('HIT')

        // Local analogue of the production tag purge (the Cloudflare API call itself is
        // covered in city-cache.test.ts): the entry disappears, the next request misses
        // and re-caches, and traffic keeps flowing.
        expect(await cache.delete(cityCacheKey(url, 'berlin'))).toBe(true)

        const afterPurge = await edgeRequest(url)
        expect(afterPurge.status).toBe(200)
        expect(afterPurge.headers.get('X-Edge-Cache')).toBe('MISS')
        expect((await edgeRequest(url)).headers.get('X-Edge-Cache')).toBe('HIT')
    })
})

// Error paths can't be forced through the real routes, so a minimal app around the two
// middlewares pins down what must NOT be cached or tagged.
describe('transit cache middlewares on error responses', () => {
    const errorApp = new Hono<Env>()
    errorApp.use('*', async (c, next) => {
        c.set('city', getCity('berlin')!)
        await next()
    })
    errorApp.use('*', transitEdgeCacheMiddleware)
    errorApp.use('*', transitCacheMiddleware)
    errorApp.get('/v0/transit/lines', (c) => c.json({ error: 'boom' }, 500))
    errorApp.get('/v0/transit/missing', (c) => c.json({ error: 'not found' }, 404))
    errorApp.post('/v0/transit/lines', (c) => c.json({ ok: true }))

    const errorRequest = async (url: string, method = 'GET') => {
        warmedUrls.push(url)
        const ctx = createExecutionContext()
        const response = await errorApp.request(url, { method }, testEnv(), ctx)
        await waitOnExecutionContext(ctx)
        return response
    }

    it('a 5xx gets no Cache-Control/Cache-Tag and is not stored', async () => {
        const url = `${BASE}/v0/transit/lines?t=err5xx`
        const response = await errorRequest(url)

        expect(response.status).toBe(500)
        expect(response.headers.get('Cache-Control')).toBeNull()
        expect(response.headers.get('Cache-Tag')).toBeNull()
        expect(response.headers.get('X-Edge-Cache')).toBeNull()
        expect(await cache.match(cityCacheKey(url, 'berlin'))).toBeUndefined()
    })

    it('a non-200 below 500 keeps its cache headers but is not stored at the edge', async () => {
        const url = `${BASE}/v0/transit/missing?t=err404`
        const response = await errorRequest(url)

        expect(response.status).toBe(404)
        expect(response.headers.get('Cache-Control')).toBe(TRANSIT_CACHE_CONTROL)
        expect(response.headers.get('Cache-Tag')).toBe(transitCacheTag('berlin'))
        expect(response.headers.get('X-Edge-Cache')).toBeNull()
        expect(await cache.match(cityCacheKey(url, 'berlin'))).toBeUndefined()
    })

    it('non-GET responses get no cache headers', async () => {
        const url = `${BASE}/v0/transit/lines?t=post`
        const response = await errorRequest(url, 'POST')

        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBeNull()
        expect(response.headers.get('Cache-Tag')).toBeNull()
    })
})
