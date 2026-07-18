import { getCityDatabase } from '@freifahren/cities'

import { logger } from '../common/logger'

import { applyMigrations } from './migrate'

// Applies the shared drizzle/ migrations to one city's D1 database, resolving the binding from the
// @freifahren/cities database registry (never a hard-coded binding).
//
//   Local:  bun run db:migrate                      → berlin's local D1 in .wrangler/state
//   Local:  bun run db:migrate --city leipzig       → leipzig's local D1
//   Remote: bun run db:migrate:remote --city <slug> → that city's production D1
//
// Runs under tsx (see the db:migrate* scripts) so it can import the @freifahren/cities alias.

// Validate against the provisioned-database registry (not the runtime city registry) so a database
// Can be migrated before its transit configuration lands. Defaults to berlin.
const parseCityArg = (argv: string[] = process.argv): string => {
    const flag = argv.indexOf('--city')
    const slug = flag !== -1 ? argv[flag + 1] : 'berlin'

    if (!slug) {
        throw new Error('--city requires a value, e.g. --city berlin')
    }
    if (!getCityDatabase(slug)) {
        throw new Error(`Unknown city "${slug}" — not a provisioned city database in @freifahren/cities`)
    }
    return slug
}

const migrate = () => {
    const city = parseCityArg()
    const remote = process.argv.includes('--remote')
    const { dbBinding } = getCityDatabase(city)!

    logger.info({ city, binding: dbBinding, target: remote ? 'remote' : 'local' }, 'Applying D1 migrations...')
    applyMigrations({ binding: dbBinding, remote })
    logger.info({ city, binding: dbBinding, target: remote ? 'remote' : 'local' }, 'D1 migrations applied')
}

try {
    migrate()
    process.exit(0)
} catch (error) {
    logger.error(error, 'D1 migration failed')
    process.exit(1)
}
