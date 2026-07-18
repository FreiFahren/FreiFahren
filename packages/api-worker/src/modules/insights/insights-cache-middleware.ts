import type { MiddlewareHandler } from 'hono'

import type { Env } from '../../app-env'

export const VERSIONED_INSIGHTS_CACHEABLE_PATH = '/:version{v\\d+}/insights/station/:stationId'

export const INSIGHTS_CACHE_CONTROL = 'public, max-age=0, must-revalidate'
export const INSIGHTS_WORKERS_CACHE_CONTROL = 'public, max-age=86400'

export const insightsCacheMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    await next()

    if (c.req.method !== 'GET' || c.res.status >= 400) return

    c.header('Cache-Control', INSIGHTS_CACHE_CONTROL)
    c.header('Cloudflare-CDN-Cache-Control', INSIGHTS_WORKERS_CACHE_CONTROL)
}
