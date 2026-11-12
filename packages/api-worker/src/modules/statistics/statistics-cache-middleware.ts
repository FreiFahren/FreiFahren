import type { MiddlewareHandler } from 'hono'

import type { Env } from '../../app-env'

export const VERSIONED_STATISTICS_CACHEABLE_PATHS = ['/:version{v\\d+}/statistics'] as const

export const STATISTICS_CACHE_CONTROL = 'public, max-age=0, must-revalidate'

// An overdue snapshot is still cached briefly, so a lagging cron doesn't send every request to D1.
const MIN_EDGE_TTL_SECONDS = 60

export const statisticsCacheMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    await next()

    const refreshAt = c.get('statisticsRefreshAt')
    if (c.req.method !== 'GET' || c.res.status >= 400 || refreshAt === undefined) return

    if (c.env.PUBLIC_EDGE_CACHE_DISABLED === 'true') {
        c.header('Cache-Control', 'no-store')
        c.header('Cloudflare-CDN-Cache-Control', 'no-store')
        return
    }

    // The edge holds the snapshot until the cron replaces it; browsers revalidate on every use.
    const edgeTtl = Math.max(MIN_EDGE_TTL_SECONDS, Math.ceil((refreshAt - Date.now()) / 1000))
    c.header('Cache-Control', STATISTICS_CACHE_CONTROL)
    c.header('Cloudflare-CDN-Cache-Control', `public, max-age=${edgeTtl}`)
}
