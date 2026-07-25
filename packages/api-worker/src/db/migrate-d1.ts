import { getCityDatabase } from '@freifahren/cities'

import { logger } from '../common/logger'

import { parseCityDatabasesArg, parseConfigArg } from './cli-args'
import { applyMigrations } from './migrate'

// Without --city, migrate every provisioned city so all databases stay on one schema.
const migrate = () => {
    const remote = process.argv.includes('--remote')
    const target = remote ? 'remote' : 'local'
    const configPath = parseConfigArg()

    for (const city of parseCityDatabasesArg()) {
        const { dbBinding } = getCityDatabase(city)!
        logger.info({ city, binding: dbBinding, target, configPath }, 'Applying D1 migrations...')
        applyMigrations({ binding: dbBinding, remote, configPath })
    }
}

try {
    migrate()
    process.exit(0)
} catch (error) {
    logger.error(error, 'D1 migration failed')
    process.exit(1)
}
