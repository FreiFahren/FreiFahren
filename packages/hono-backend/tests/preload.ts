// We suppress logging in tests to avoid cluttering the output.
// But to debug a test failure, you can run `TEST_LOG_LEVEL=info bun test` to enable logging.
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? 'error'
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL

import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from '../src/db'
import { seedBaseData } from '../src/db/seed/seed'

await migrate(db, { migrationsFolder: './drizzle' })

// Seed the read-only reference tables (stations, lines, line_stations, segments) once for the whole test run.
await seedBaseData(db)
