import { logger } from '../../common/logger'
import { transitCacheTag } from '../../modules/transit/transit-cache-middleware'

// Purge only the given city's transit Cache-Tag, so reseeding one city never
// Invalidates another city's cached transit responses. Credentials come from the
// Environment by default (the deploy-pipeline CLI); callers may inject them instead.
export const purgeTransitCache = async (citySlug: string, credentials: { zoneId?: string; apiToken?: string } = {}) => {
    const zoneId = credentials.zoneId ?? process.env.CLOUDFLARE_ZONE_ID
    const apiToken = credentials.apiToken ?? process.env.CLOUDFLARE_API_TOKEN
    const tag = transitCacheTag(citySlug)

    if (zoneId === undefined || zoneId === '' || apiToken === undefined || apiToken === '') {
        logger.info('Skipping Cloudflare transit cache purge (CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN not set)')
        return
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            tags: [tag],
        }),
    })

    if (!response.ok) {
        const body = await response.text()
        // Throw rather than warn-and-return: a swallowed failure (e.g. a 401 from a
        // Token without Cache Purge rights) lets a stale transit response keep serving
        // For its full 30-day TTL, which silently breaks the risk map after a reseed.
        throw new Error(`Cloudflare transit cache purge failed (status ${response.status}): ${body}`)
    }

    logger.info({ tag }, 'Cloudflare transit cache purged')
}
