import type { MiddlewareHandler } from 'hono'

import type { Env } from '../../app-env'

export const VERSIONED_TRANSIT_PATH = '/:version{v\\d+}/transit/*'

export const VERSIONED_TRANSIT_CACHEABLE_PATHS = [
    '/:version{v\\d+}/transit/stations',
    '/:version{v\\d+}/transit/lines',
    '/:version{v\\d+}/transit/segments',
] as const

export const TRANSIT_CACHE_TAG = 'transit-network'
export const TRANSIT_CACHE_CONTROL = 'public, max-age=2592000, stale-while-revalidate=86400'

export const transitCacheMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    await next()

    if (c.req.method !== 'GET') {
        return
    }

    if (c.res.status >= 500) {
        return
    }

    c.header('Cache-Control', TRANSIT_CACHE_CONTROL)
    c.header('Cache-Tag', TRANSIT_CACHE_TAG)
}
