import { CITY_DATABASE_SLUGS, getCityDatabase } from '@freifahren/cities'

import { logger } from '../common/logger'

import { applyMigrations } from './migrate'

// Without --city, migrate every provisioned city so all databases stay on one schema. A slug is
// Validated against the database registry (not the runtime city registry), so a database can be
// Migrated before its transit configuration lands.
const parseCitiesArg = (argv: string[] = process.argv): string[] => {
    const flag = argv.indexOf('--city')
    if (flag === -1) return [...CITY_DATABASE_SLUGS]

    const slug = argv[flag + 1]
    if (!slug) {
        throw new Error('--city requires a value, e.g. --city berlin')
    }
    if (!getCityDatabase(slug)) {
        throw new Error(`Unknown city "${slug}" — not a provisioned city database in @freifahren/cities`)
    }
    return [slug]
}

const migrate = () => {
    const remote = process.argv.includes('--remote')
    const target = remote ? 'remote' : 'local'

    for (const city of parseCitiesArg()) {
        const { dbBinding } = getCityDatabase(city)!
        logger.info({ city, binding: dbBinding, target }, 'Applying D1 migrations...')
        applyMigrations({ binding: dbBinding, remote })
    }
}

try {
    migrate()
    process.exit(0)
} catch (error) {
    logger.error(error, 'D1 migration failed')
    process.exit(1)
}
