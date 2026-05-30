import { logger } from '../../common/logger'
import { db } from '../index'

import { seedBaseData } from './seed'

const seed = async () => {
    logger.info('Starting seed...')

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
