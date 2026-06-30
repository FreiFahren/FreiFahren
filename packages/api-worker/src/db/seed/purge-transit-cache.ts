import { logger } from '../../common/logger'
import { TRANSIT_CACHE_TAG } from '../../modules/transit/transit-cache-middleware'

export const purgeTransitCache = async () => {
    const zoneId = Bun.env.CLOUDFLARE_ZONE_ID
    const apiToken = Bun.env.CLOUDFLARE_API_TOKEN

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
            tags: [TRANSIT_CACHE_TAG],
        }),
    })

    if (!response.ok) {
        const body = await response.text()
        // Throw rather than warn-and-return: a swallowed failure (e.g. a 401 from a
        // Token without Cache Purge rights) lets a stale transit response keep serving
        // For its full 30-day TTL, which silently breaks the risk map after a reseed.
        throw new Error(`Cloudflare transit cache purge failed (status ${response.status}): ${body}`)
    }

    logger.info({ tag: TRANSIT_CACHE_TAG }, 'Cloudflare transit cache purged')
}
