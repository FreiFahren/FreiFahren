/// <reference types="@cloudflare/workers-types" />
import type { MiddlewareHandler } from 'hono'

import type { Env } from '../../app-env'

export const VERSIONED_TRANSIT_PATH = '/:version{v\\d+}/transit/*'

export const VERSIONED_TRANSIT_CACHEABLE_PATHS = [
    '/:version{v\\d+}/transit/stations',
    '/:version{v\\d+}/transit/lines',
    '/:version{v\\d+}/transit/segments',
] as const

export const TRANSIT_CACHE_TAG_PREFIX = 'transit-network'

// Per-city Cache-Tag. Purging one city's tag (on its reseed) leaves every other
// City's cached entries intact — the single global tag would purge all cities.
export const transitCacheTag = (citySlug: string): string => `${TRANSIT_CACHE_TAG_PREFIX}-${citySlug}`

// Canonical edge cache key: force the resolved `?city=` onto the URL and sort the
// Params, so the default (no param) and an explicit `?city=berlin` collapse to one
// Entry while different cities get distinct entries. The city is always in the key.
export const cityCacheKey = (requestUrl: string, citySlug: string): Request => {
    const url = new URL(requestUrl)
    url.searchParams.set('city', citySlug)
    url.searchParams.sort()
    return new Request(url.toString(), { method: 'GET' })
}
/*
 * Split TTL: the edge (a shared cache, including the Workers Cache API entry
 * below) keeps the response for 30 days via s-maxage, but browsers get
 * max-age=0 + must-revalidate so they always revalidate with an If-None-Match.
 * On a hit that revalidation is a cheap 304; after a reseed/purge the body's
 * ETag changes and the browser gets the fresh segments immediately. A single
 * long max-age would instead let every client serve stale geometry for up to
 * 30 days after an id-changing reseed, which silently breaks the risk map.
 */
export const TRANSIT_CACHE_CONTROL = 'public, max-age=0, s-maxage=2592000, must-revalidate'

export const transitCacheMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    await next()

    if (c.req.method !== 'GET') {
        return
    }

    if (c.res.status >= 500) {
        return
    }

    c.header('Cache-Control', TRANSIT_CACHE_CONTROL)
    c.header('Cache-Tag', transitCacheTag(c.get('city').slug))
}

// Stripped before storing so one entry serves every origin; cors() re-adds them per request.
const ORIGIN_SPECIFIC_HEADERS = ['access-control-allow-origin', 'access-control-allow-credentials', 'vary']

// The global CacheStorage type (DOM lib) lacks the Cloudflare-specific `default` cache.
interface EdgeCache {
    match(request: Request): Promise<Response | undefined>
    put(request: Request, response: Response): Promise<void>
}

const stripWeak = (tag: string): string => tag.trim().replace(/^W\//, '')

const ifNoneMatchSatisfied = (header: string, etag: string): boolean => {
    if (header.trim() === '*') {
        return true
    }
    const target = stripWeak(etag)
    return header.split(',').some((candidate) => stripWeak(candidate) === target)
}

/*
 * Cache Rules never cache a Worker's own generated response (only its outbound
 * fetch subrequests), so we cache here via the Cache API. The entry keeps the
 * Cache-Tag set by transitCacheMiddleware, so purge-by-tag still works.
 */
export const transitEdgeCacheMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    // Absent under unit tests (Bun); fall through to the live handler.
    const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: EdgeCache }).default : undefined
    let executionCtx: { waitUntil(promise: Promise<unknown>): void } | undefined
    try {
        executionCtx = c.executionCtx
    } catch {
        executionCtx = undefined
    }

    if (c.req.method !== 'GET' || cache === undefined || executionCtx === undefined) {
        await next()
        return
    }

    const cacheKey = cityCacheKey(c.req.url, c.get('city').slug)
    const cached = await cache.match(cacheKey)

    if (cached !== undefined) {
        const etag = cached.headers.get('ETag')
        const ifNoneMatch = c.req.header('If-None-Match')
        if (etag !== null && ifNoneMatch !== undefined && ifNoneMatchSatisfied(ifNoneMatch, etag)) {
            c.res = new Response(null, {
                status: 304,
                headers: { ETag: etag, 'Cache-Control': cached.headers.get('Cache-Control') ?? '' },
            })
        } else {
            c.res = new Response(cached.body, cached)
        }
        c.header('X-Edge-Cache', 'HIT')
        return
    }

    await next()

    if (c.res.status !== 200) {
        return
    }

    const entry = new Response(c.res.clone().body, c.res)
    for (const header of ORIGIN_SPECIFIC_HEADERS) {
        entry.headers.delete(header)
    }
    executionCtx.waitUntil(cache.put(cacheKey, entry))
    c.header('X-Edge-Cache', 'MISS')
}
