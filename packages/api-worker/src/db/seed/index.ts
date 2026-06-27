import { logger } from '../../common/logger'
import { createDb } from '../index'

import { seedBaseData } from './seed'

// Seeds the read-only reference tables from the bundled OSM snapshots. Report-preserving (upsert
// + orphan-remap), so it is safe to run on every deploy.
const seed = async () => {
    logger.info('Starting seed...')

    const db = createDb(process.env.DATABASE_URL!)
    await seedBaseData(db)

    logger.info('Seed completed successfully!')
}

seed()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => {
        logger.error(error, 'Seed failed')
        process.exit(1)
    })
