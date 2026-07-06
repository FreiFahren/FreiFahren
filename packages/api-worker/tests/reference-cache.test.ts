import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { cachedReference, referenceCacheKey } from '../src/modules/transit/reference-cache'
import { cityCacheKey, TRANSIT_CACHE_CONTROL, transitCacheTag } from '../src/modules/transit/transit-cache-middleware'

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

// Storage is shared across suites (isolatedStorage: false); every key a test touches is
// deleted again so no other suite reads this file's fabricated reference data.
const usedKeys: Request[] = []

const internalKey = (citySlug: string, key: string): Request => {
    const request = new Request(referenceCacheKey(citySlug, key))
    usedKeys.push(request)
    return request
}

afterEach(async () => {
    for (const key of usedKeys.splice(0)) {
        await cache.delete(key)
    }
})

const withCtx = async <T>(run: (ctx: ExecutionContext) => Promise<T>): Promise<T> => {
    const ctx = createExecutionContext()
    const result = await run(ctx)
    await waitOnExecutionContext(ctx)
    return result
}

describe('cachedReference (real Cache API)', () => {
    it('invokes the loader once on a miss and serves the second call from the cache', async () => {
        internalKey('berlin', 'spec-read-through')
        const loader = vi.fn(async () => ({ answer: 42 }))

        const first = await withCtx((ctx) => cachedReference('berlin', 'spec-read-through', loader, ctx))
        const second = await withCtx((ctx) => cachedReference('berlin', 'spec-read-through', loader, ctx))

        expect(loader).toHaveBeenCalledTimes(1)
        expect(first).toEqual({ answer: 42 })
        expect(second).toEqual({ answer: 42 })
    })

    it('stores the entry with the city Cache-Tag, so the tag purge clears this layer too', async () => {
        const key = internalKey('berlin', 'spec-tag')
        await withCtx((ctx) => cachedReference('berlin', 'spec-tag', async () => 'tagged', ctx))

        const entry = await cache.match(key)
        expect(entry).toBeDefined()
        expect(entry!.headers.get('Cache-Tag')).toBe(transitCacheTag('berlin'))
        expect(entry!.headers.get('Cache-Control')).toBe(TRANSIT_CACHE_CONTROL)
    })

    it('does not collide with the HTTP edge-cache keys for the same resource', async () => {
        // A warm HTTP entry for /v0/transit/stations must not satisfy the internal
        // "stations" lookup — the synthetic INTERNAL_ORIGIN keeps the namespaces apart.
        const edgeKey = cityCacheKey('https://api.test/v0/transit/stations', 'berlin')
        usedKeys.push(edgeKey)
        await cache.put(edgeKey, new Response('"http-entry"', { headers: { 'Cache-Control': 'max-age=60' } }))

        internalKey('berlin', 'stations')
        const loader = vi.fn(async () => 'from-loader')
        const value = await withCtx((ctx) => cachedReference('berlin', 'stations', loader, ctx))

        expect(loader).toHaveBeenCalledTimes(1)
        expect(value).toBe('from-loader')
        // And the reference write must not clobber the HTTP entry either.
        expect(await (await cache.match(edgeKey))!.text()).toBe('"http-entry"')
    })

    it('skips the cache write without an ExecutionContext, so the next call loads again', async () => {
        internalKey('berlin', 'spec-no-ctx')
        const loader = vi.fn(async () => 'uncached')

        expect(await cachedReference('berlin', 'spec-no-ctx', loader, undefined)).toBe('uncached')
        expect(await cachedReference('berlin', 'spec-no-ctx', loader, undefined)).toBe('uncached')

        expect(loader).toHaveBeenCalledTimes(2)
    })
})
