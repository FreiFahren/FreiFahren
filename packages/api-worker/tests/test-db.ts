import { env } from 'cloudflare:test'

import { createD1Db } from '../src/db'

// D1-backed drizzle for direct setup/teardown and assertions in tests — the same binding the app
// uses. The reference tables are migrated and seeded once in tests/setup.ts; per-test writes are
// rolled back automatically by the pool's isolated storage.
export const db = createD1Db(env.DB)

export * from '../src/db'
