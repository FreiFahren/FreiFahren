/// <reference types="@cloudflare/workers-types" />
import { transitCacheTag } from './transit-cache-middleware'

export const REFERENCE_CACHE_CONTROL = 'public, max-age=2592000'

// The global CacheStorage type (DOM lib) lacks the Cloudflare-specific `default` cache.
interface EdgeCache {
    match(request: Request): Promise<Response | undefined>
    put(request: Request, response: Response): Promise<void>
}

// Synthetic origin for internal cache keys — never routed, just a stable key namespace
// That cannot collide with request URLs.
const INTERNAL_ORIGIN = 'https://transit-reference.internal'

// City-scoped internal cache key, so one city's reference data never serves another's.
export const referenceCacheKey = (citySlug: string, key: string): string => `${INTERNAL_ORIGIN}/${citySlug}/${key}`

export type CacheCtx = { waitUntil(promise: Promise<unknown>): void } | undefined

/*
 * Read-through cache for static transit reference data (stations, lines, segments,
 * and the /distance graph inputs),
 * backed by `cache.default`. Because the entry carries the `transit-network` Cache-Tag,
 * the existing `db:purge-cache` tag purge invalidates it after a reseed.
 *
 * Falls through to the loader (a direct D1 read) whenever the Cache API is absent —
 * i.e. under Bun (tests) and the Node seed CLI — so those paths are unchanged.
 */
export const cachedReference = async <T>(
    citySlug: string,
    key: string,
    loader: () => Promise<T>,
    ctx: CacheCtx
): Promise<T> => {
    const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: EdgeCache }).default : undefined
    if (cache === undefined) {
        return loader()
    }

    const cacheKey = new Request(referenceCacheKey(citySlug, key))
    const cached = await cache.match(cacheKey)
    if (cached !== undefined) {
        return (await cached.json()) as T
    }

    const value = await loader()
    const entry = new Response(JSON.stringify(value), {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': REFERENCE_CACHE_CONTROL,
            'Cache-Tag': transitCacheTag(citySlug),
        },
    })
    // Don't let the cache write delay the response; on Node/tests (no ctx) it is a no-op anyway.
    if (ctx !== undefined) {
        ctx.waitUntil(cache.put(cacheKey, entry))
    }
    return value
}
