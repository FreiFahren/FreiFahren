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

/*
 * Split TTL: Workers Cache keeps the response for 30 days via its Cloudflare-specific
 * directive, but browsers get max-age=0 + must-revalidate so they always revalidate with
 * an If-None-Match.
 * On a hit that revalidation is a cheap 304. A single long max-age would instead
 * let every client serve stale reference data after a deployment.
 */
export const TRANSIT_CACHE_CONTROL = 'public, max-age=0, must-revalidate'
export const TRANSIT_WORKERS_CACHE_CONTROL = 'public, max-age=2592000'

export const transitCacheMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    await next()

    if (c.req.method !== 'GET') {
        return
    }

    if (c.res.status >= 500) {
        return
    }

    c.header('Cache-Control', TRANSIT_CACHE_CONTROL)
    c.header('Cloudflare-CDN-Cache-Control', TRANSIT_WORKERS_CACHE_CONTROL)
    c.header('Cache-Tag', transitCacheTag(c.get('city').slug))
}
