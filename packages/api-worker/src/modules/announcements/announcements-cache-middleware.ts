import type { MiddlewareHandler } from 'hono'

import type { Env } from '../../app-env'

import { msUntilNextPublish } from './announcements-service'

export const VERSIONED_ANNOUNCEMENTS_PATH = '/:version{v\\d+}/announcements/*'

// One tag for every city and language: announcements only change with a deploy, which purges it.
export const ANNOUNCEMENTS_CACHE_TAG = 'announcements'

/*
 * Split TTL, as in the transit module: the edge holds the response until the post-deploy purge,
 * while browsers revalidate with their ETag on every use.
 */
export const ANNOUNCEMENTS_CACHE_CONTROL = 'public, max-age=0, must-revalidate'
export const ANNOUNCEMENTS_EDGE_TTL_SECONDS = 2592000

// A scheduled announcement goes live without a deploy, so the edge copy must expire by then.
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
    c.header('Cache-Tag', ANNOUNCEMENTS_CACHE_TAG)
}
