import type { MiddlewareHandler } from 'hono'

import type { Env } from '../../app-env'

export const VERSIONED_ANNOUNCEMENTS_PATH = '/:version{v\\d+}/announcements/*'

// One tag for every city and language: announcements only change with a deploy, which purges it.
export const ANNOUNCEMENTS_CACHE_TAG = 'announcements'

/*
 * Split TTL, as in the transit module: the edge holds the response until the post-deploy purge,
 * while browsers revalidate with their ETag on every use.
 */
export const ANNOUNCEMENTS_CACHE_CONTROL = 'public, max-age=0, must-revalidate'
export const ANNOUNCEMENTS_WORKERS_CACHE_CONTROL = 'public, max-age=2592000'

export const announcementsCacheMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    await next()
    if (c.req.method !== 'GET' || c.res.status >= 400) return
    c.header('Cache-Control', ANNOUNCEMENTS_CACHE_CONTROL)
    c.header('Cloudflare-CDN-Cache-Control', ANNOUNCEMENTS_WORKERS_CACHE_CONTROL)
    c.header('Cache-Tag', ANNOUNCEMENTS_CACHE_TAG)
}
