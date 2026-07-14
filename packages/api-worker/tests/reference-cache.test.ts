import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { cachedReference, REFERENCE_CACHE_CONTROL, referenceCacheKey } from '../src/modules/transit/reference-cache'
import { transitCacheTag } from '../src/modules/transit/transit-cache-middleware'

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
        expect(entry!.headers.get('Cache-Control')).toBe(REFERENCE_CACHE_CONTROL)
    })

    it('namespaces cached values by resource key', async () => {
        internalKey('berlin', 'stations')
        internalKey('berlin', 'lines')
        const loader = vi.fn(async () => 'from-loader')
        const value = await withCtx((ctx) => cachedReference('berlin', 'stations', loader, ctx))

        expect(loader).toHaveBeenCalledTimes(1)
        expect(value).toBe('from-loader')
        expect(await cache.match(new Request(referenceCacheKey('berlin', 'lines')))).toBeUndefined()
    })

    it('skips the cache write without an ExecutionContext, so the next call loads again', async () => {
        internalKey('berlin', 'spec-no-ctx')
        const loader = vi.fn(async () => 'uncached')

        expect(await cachedReference('berlin', 'spec-no-ctx', loader, undefined)).toBe('uncached')
        expect(await cachedReference('berlin', 'spec-no-ctx', loader, undefined)).toBe('uncached')

        expect(loader).toHaveBeenCalledTimes(2)
    })
})
