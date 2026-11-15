import type { MiddlewareHandler } from 'hono'
import { DateTime } from 'luxon'

import type { Env } from '../../app-env'

export const VERSIONED_INSIGHTS_CACHEABLE_PATHS = [
    '/:version{v\\d+}/insights/station/:stationId',
    '/:version{v\\d+}/insights/lines/:lineName',
    '/:version{v\\d+}/insights/lines',
    '/:version{v\\d+}/insights/summary',
] as const

export const INSIGHTS_CACHE_CONTROL = 'public, max-age=0, must-revalidate'
export const INSIGHTS_WORKERS_CACHE_CONTROL = 'public, max-age=86400'
// The summary covers windows ending now, so it goes stale far sooner than the daily insights.
export const REPORT_SUMMARY_WORKERS_CACHE_CONTROL = 'public, max-age=3600'

const lineInsightsWorkersCacheControl = (timezone: string): string => {
    const now = DateTime.now().setZone(timezone)
    const nextLocalMidnight = now.plus({ days: 1 }).startOf('day')
    const maxAge = Math.max(1, Math.ceil(nextLocalMidnight.diff(now, 'seconds').seconds))
    return `public, max-age=${maxAge}`
}

export const insightsCacheMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    await next()

    if (c.req.method !== 'GET' || c.res.status >= 400) return

    if (c.env.PUBLIC_EDGE_CACHE_DISABLED === 'true') {
        c.header('Cache-Control', 'no-store')
        c.header('Cloudflare-CDN-Cache-Control', 'no-store')
        return
    }

    c.header('Cache-Control', INSIGHTS_CACHE_CONTROL)
    let workersCacheControl = INSIGHTS_WORKERS_CACHE_CONTROL
    if (c.req.path.includes('/insights/lines')) {
        workersCacheControl = lineInsightsWorkersCacheControl(c.get('city').timezone)
    } else if (c.req.path.includes('/insights/summary')) {
        workersCacheControl = REPORT_SUMMARY_WORKERS_CACHE_CONTROL
    }
    c.header('Cloudflare-CDN-Cache-Control', workersCacheControl)
}
