import { logger } from '../common/logger'

import { parseCityArg } from './seed/city-arg'
import { purgeTransitCache } from './seed/purge-transit-cache'

// Purges one city's cache.default entries by tag. Run after `db:seed` in the deployment pipeline.
// City comes from `--city <slug>` (defaults to berlin).
purgeTransitCache(parseCityArg())
    .then(() => {
        process.exit(0)
    })
    .catch((error) => {
        logger.error(error, 'Cache purge failed')
        process.exit(1)
    })
