import { logger } from '../../common/logger'

const PURGE_PREFIX = 'api.freifahren.org/v0/transit'

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
            prefixes: [PURGE_PREFIX],
        }),
    })

    if (!response.ok) {
        const body = await response.text()
        logger.warn({ status: response.status, body }, 'Cloudflare transit cache purge failed')
        return
    }

    logger.info({ prefix: PURGE_PREFIX }, 'Cloudflare transit cache purged')
}
