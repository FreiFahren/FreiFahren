import { logger } from '../common/logger'

import { purgeTransitCache } from './seed/purge-transit-cache'

// Purges the transit edge cache by tag. Run after `db:seed` in the deploy pipeline.
purgeTransitCache()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => {
        logger.error(error, 'Cache purge failed')
        process.exit(1)
    })
