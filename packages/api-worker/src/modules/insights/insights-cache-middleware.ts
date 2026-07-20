import type { MiddlewareHandler } from 'hono'
import { DateTime } from 'luxon'

import type { Env } from '../../app-env'

export const VERSIONED_INSIGHTS_CACHEABLE_PATHS = [
    '/:version{v\\d+}/insights/station/:stationId',
    '/:version{v\\d+}/insights/line/:lineId',
] as const

export const INSIGHTS_CACHE_CONTROL = 'public, max-age=0, must-revalidate'
export const INSIGHTS_WORKERS_CACHE_CONTROL = 'public, max-age=86400'

const lineInsightsWorkersCacheControl = (timezone: string): string => {
    const now = DateTime.now().setZone(timezone)
    const nextLocalMidnight = now.plus({ days: 1 }).startOf('day')
    const maxAge = Math.max(1, Math.ceil(nextLocalMidnight.diff(now, 'seconds').seconds))
    return `public, max-age=${maxAge}`
}

export const insightsCacheMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    await next()

    if (c.req.method !== 'GET' || c.res.status >= 400) return

    c.header('Cache-Control', INSIGHTS_CACHE_CONTROL)
    const lineId = c.req.param('lineId')
    c.header(
        'Cloudflare-CDN-Cache-Control',
        lineId !== undefined ? lineInsightsWorkersCacheControl(c.get('city').timezone) : INSIGHTS_WORKERS_CACHE_CONTROL
    )
}
