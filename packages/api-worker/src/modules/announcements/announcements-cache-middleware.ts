import type { MiddlewareHandler } from 'hono'

import type { Env } from '../../app-env'

import { msUntilNextPublish } from './announcements-service'

export const VERSIONED_ANNOUNCEMENTS_PATH = '/:version{v\\d+}/announcements/*'

/*
 * Split TTL, as in the transit module: browsers revalidate with their ETag on every use, while the
 * edge holds the response for an hour. No purge: a deployed announcement shows within that hour.
 */
export const ANNOUNCEMENTS_CACHE_CONTROL = 'public, max-age=0, must-revalidate'
export const ANNOUNCEMENTS_EDGE_TTL_SECONDS = 60 * 60

// A scheduled announcement goes live on its own, so the edge copy must expire by then.
const edgeTtlSeconds = () => {
    const pending = msUntilNextPublish()
    return pending === null
        ? ANNOUNCEMENTS_EDGE_TTL_SECONDS
        : Math.min(ANNOUNCEMENTS_EDGE_TTL_SECONDS, Math.ceil(pending / 1000))
}

export const announcementsCacheMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    await next()
    if (c.req.method !== 'GET' || c.res.status >= 400) return
    c.header('Cache-Control', ANNOUNCEMENTS_CACHE_CONTROL)
    c.header('Cloudflare-CDN-Cache-Control', `public, max-age=${edgeTtlSeconds()}`)
}
