/// <reference types="@cloudflare/workers-types" />
import { TRANSIT_CACHE_CONTROL, TRANSIT_CACHE_TAG } from './transit-cache-middleware'

// The global CacheStorage type (DOM lib) lacks the Cloudflare-specific `default` cache.
interface EdgeCache {
    match(request: Request): Promise<Response | undefined>
    put(request: Request, response: Response): Promise<void>
}

// Synthetic origin for internal cache keys — never routed, just a stable key namespace
// That cannot collide with real request URLs stored by transitEdgeCacheMiddleware.
const INTERNAL_ORIGIN = 'https://transit-reference.internal'

export type CacheCtx = { waitUntil(promise: Promise<unknown>): void } | undefined

/*
 * Read-through cache for static transit reference data (stations, lines, segments),
 * backed by the same Workers Cache API + `transit-network` Cache-Tag that
 * transitEdgeCacheMiddleware uses for the HTTP responses. Because the entry carries
 * that tag, the existing `db:purge-cache` tag purge invalidates it too — so a reseed
 * clears both layers and there is no TTL to tune.
 *
 * Falls through to the loader (a direct D1 read) whenever the Cache API is absent —
 * i.e. under Bun (tests) and the Node seed CLI — so those paths are unchanged.
 */
export const cachedReference = async <T>(key: string, loader: () => Promise<T>, ctx: CacheCtx): Promise<T> => {
    const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: EdgeCache }).default : undefined
    if (cache === undefined) {
        return loader()
    }

    const cacheKey = new Request(`${INTERNAL_ORIGIN}/${key}`)
    const cached = await cache.match(cacheKey)
    if (cached !== undefined) {
        return (await cached.json()) as T
    }

    const value = await loader()
    const entry = new Response(JSON.stringify(value), {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': TRANSIT_CACHE_CONTROL,
            'Cache-Tag': TRANSIT_CACHE_TAG,
        },
    })
    // Don't let the cache write delay the response; on Node/tests (no ctx) it is a no-op anyway.
    if (ctx !== undefined) {
        ctx.waitUntil(cache.put(cacheKey, entry))
    }
    return value
}
