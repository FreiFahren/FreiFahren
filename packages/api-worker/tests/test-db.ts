import { createDb } from '../src/db'

// Db client for direct setup/teardown and assertions in tests.
export const db = createDb(process.env.DATABASE_URL!)

export * from '../src/db'
