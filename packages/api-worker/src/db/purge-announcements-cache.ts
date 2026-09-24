import { logger } from '../common/logger'

import { purgeAnnouncementsCache } from './purge-cache-tags'

/*
 * Run after `wrangler deploy`: every deploy may ship new announcements, and purging any earlier
 * would let the previous worker refill the edge with the old list.
 */
purgeAnnouncementsCache()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => {
        logger.error(error, 'Announcements cache purge failed')
        process.exit(1)
    })
