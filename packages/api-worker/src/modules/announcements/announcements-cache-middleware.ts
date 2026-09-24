import type { MiddlewareHandler } from 'hono'

import type { Env } from '../../app-env'

export const VERSIONED_ANNOUNCEMENTS_PATH = '/:version{v\\d+}/announcements/*'

/*
 * Split TTL, as in the transit module: browsers revalidate with their ETag on every use, while the
 * edge holds the response for a day. No purge: a new announcement reaches everyone within that day.
 */
export const ANNOUNCEMENTS_CACHE_CONTROL = 'public, max-age=0, must-revalidate'
export const ANNOUNCEMENTS_WORKERS_CACHE_CONTROL = 'public, max-age=86400'

export const announcementsCacheMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    await next()
    if (c.req.method !== 'GET' || c.res.status >= 400) return
    c.header('Cache-Control', ANNOUNCEMENTS_CACHE_CONTROL)
    c.header('Cloudflare-CDN-Cache-Control', ANNOUNCEMENTS_WORKERS_CACHE_CONTROL)
}
