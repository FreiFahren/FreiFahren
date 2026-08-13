/// <reference types="@cloudflare/workers-types" />
import type { MiddlewareHandler } from 'hono'

import type { Env } from '../../app-env'

export const VERSIONED_REPORTS_CACHEABLE_PATHS = ['/:version{v\\d+}/reports/:stationId'] as const

export const REPORTS_CACHE_TAG_PREFIX = 'reports'

/*
 * Per-city, per-station Cache-Tag. Not what keeps entries fresh today — the explicit delete below
 * is — but it costs nothing and lets a tag purge drop a whole station at once, the way the transit
 * module already purges on reseed.
 */
export const stationReportsCacheTag = (citySlug: string, stationId: string): string =>
    `${REPORTS_CACHE_TAG_PREFIX}-${citySlug}-${stationId}`

/*
 * Split TTL, matching the transit and insights modules: the edge holds the response while browsers
 * revalidate on every use. A client therefore never paints a stale count out of its own HTTP cache,
 * and the revalidation it does send is absorbed by the edge instead of reaching D1.
 */
export const REPORTS_CACHE_CONTROL = 'public, max-age=0, must-revalidate'

/*
 * Five minutes rather than the hour the only consumer tolerates (`staleTime: HOUR_MS` in the app's
 * station report count). The explicit invalidation on write reaches just the colo that served the
 * write, so this cap — not the delete — is what bounds staleness for every other colo.
 */
export const REPORTS_EDGE_TTL_SECONDS = 300

export const reportsCacheMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    await next()

    if (c.req.method !== 'GET' || c.res.status >= 400) return

    const stationId = c.req.param('stationId')
    if (stationId === undefined) return

    /*
     * A station below the trust threshold answers differently depending on who asks, so its response
     * cannot be shared — and that includes the empty list a non-owner gets. Caching that empty list
     * would let the edge replay it to the owner on their next request, showing them their own
     * reports had vanished, which is exactly what this design exists to avoid telling them.
     *
     * Only stations that are actually below the threshold skip the cache. Everything else still
     * shares one entry per station per hour.
     */
    if (c.get('reportsUncacheable') === true) {
        c.header('Cache-Control', 'no-store')
        return
    }

    c.header('Cache-Control', REPORTS_CACHE_CONTROL)
    c.header('Cloudflare-CDN-Cache-Control', `public, max-age=${REPORTS_EDGE_TTL_SECONDS}`)
    c.header('Cache-Tag', stationReportsCacheTag(c.get('city').slug, stationId))
}

// The global CacheStorage type (DOM lib) lacks the Cloudflare-specific `default` cache.
interface EdgeCache {
    delete(request: Request): Promise<boolean>
}

const HOUR_MS = 60 * 60 * 1000
const WEEK_MS = 7 * HOUR_MS * 24

/*
 * The app requests a station's week with `to` rounded up to the next hour, which is what lets every
 * client share one cache entry per station per hour. Rebuilding that exact URL is how a new report
 * drops the entry it has just made wrong.
 *
 * This mirrors a frontend decision, so it can drift. When it does, the delete misses and the edge
 * TTL becomes the only bound — stale for at most that TTL, never wrong for longer.
 */
export const stationReportsCacheKey = (reportsUrl: URL, citySlug: string, stationId: string, now: number): URL => {
    const toMs = Math.ceil(now / HOUR_MS) * HOUR_MS
    const key = new URL(`${reportsUrl.origin}${reportsUrl.pathname.replace(/\/$/, '')}/${stationId}`)
    key.searchParams.set('from', new Date(toMs - WEEK_MS).toISOString())
    key.searchParams.set('to', new Date(toMs).toISOString())
    key.searchParams.set('decay', 'false')
    key.searchParams.set('city', citySlug)
    return key
}

/*
 * Best effort by construction: the Cache API only reaches the colo running this request, and the
 * responses are split by `Vary: Origin`, so the delete targets the variant belonging to the client
 * that just submitted — the one about to refetch its own count. Other colos and other origins fall
 * back to the TTL.
 */
export const invalidateStationReportsCache = async (
    requestUrl: string,
    requestOrigin: string | null,
    citySlug: string,
    stationId: string,
    now: number = Date.now()
): Promise<void> => {
    const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: EdgeCache }).default : undefined
    if (cache === undefined) return

    const key = stationReportsCacheKey(new URL(requestUrl), citySlug, stationId, now)
    const headers = requestOrigin === null ? undefined : { Origin: requestOrigin }
    await cache.delete(new Request(key.toString(), { headers }))
}
