import { createNodeDb } from '../src/db/node'

// Db client for direct setup/teardown and assertions in tests. Shares the same libsql file (and
// cached connection) that preload.ts migrated and seeded.
export const db = createNodeDb(process.env.DATABASE_URL!)

export * from '../src/db'
