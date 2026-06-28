import { migrate } from 'drizzle-orm/libsql/migrator'

import { logger } from '../../common/logger'
import { createNodeDbHandle } from '../node'

import { seedBaseData } from './seed'

// Seeds the read-only reference tables from the bundled OSM snapshots into a local libsql file.
// Report-preserving (upsert + orphan-remap), so it is safe to run on every deploy. The resulting
// SQLite file is loaded into D1 (e.g. `wrangler d1 import`) — seeding never runs against the D1
// Driver, so D1's lack of interactive transactions does not apply here.
const seed = async () => {
    logger.info('Starting seed...')

    const url = process.env.DATABASE_URL!
    const { db, client } = createNodeDbHandle(url)

    await client.execute('PRAGMA foreign_keys = ON')
    await migrate(db, { migrationsFolder: './drizzle' })
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
