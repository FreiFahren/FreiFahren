import { logger } from '../common/logger'
import { ANNOUNCEMENTS_CACHE_TAG } from '../modules/announcements/announcements-cache-middleware'
import { transitCacheTag } from '../modules/transit/transit-cache-middleware'

type Credentials = { zoneId?: string; apiToken?: string }

/*
 * Purges cache.default entries by Cache-Tag. Credentials come from the environment by default (the
 * deploy-pipeline CLIs); callers may inject them instead.
 */
export const purgeCacheTags = async (tags: string[], credentials: Credentials = {}) => {
    const zoneId = credentials.zoneId ?? process.env.CLOUDFLARE_ZONE_ID
    const apiToken = credentials.apiToken ?? process.env.CLOUDFLARE_API_TOKEN

    if (zoneId === undefined || zoneId === '' || apiToken === undefined || apiToken === '') {
        logger.info({ tags }, 'Skipping Cloudflare cache purge (CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN not set)')
        return
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tags }),
    })

    if (!response.ok) {
        const body = await response.text()
        // Throw rather than warn-and-return: a swallowed failure (e.g. a 401 from a token without
        // Cache Purge rights) keeps serving the stale response for its full edge TTL.
        throw new Error(`Cloudflare cache purge failed (status ${response.status}): ${body}`)
    }

    logger.info({ tags }, 'Cloudflare cache purged')
}

// Only the given city's tag, so reseeding one city never invalidates another city's transit data.
export const purgeTransitCache = (citySlug: string, credentials?: Credentials) =>
    purgeCacheTags([transitCacheTag(citySlug)], credentials)

export const purgeAnnouncementsCache = (credentials?: Credentials) =>
    purgeCacheTags([ANNOUNCEMENTS_CACHE_TAG], credentials)
