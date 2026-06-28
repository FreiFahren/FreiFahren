import { type Client, createClient } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'

import { type DbConnection, type Schema, schema } from './index'

// Node-only SQLite for tests and the seed CLI. libsql is async (like D1) so the seed's async
// Transactions run unchanged — better-sqlite3 would force synchronous transaction callbacks.
// This module is never imported from worker.ts/app-env's import graph, so libsql stays out of
// The Worker bundle; the Worker only ever uses the D1 driver in db/index.ts.
// The concrete libsql type is kept on the handle so the libsql migrator (which needs `.batch()`)
// Accepts it. The provider hands the app the widened DbConnection, which LibSQLDatabase satisfies.
type NodeDbHandle = { db: LibSQLDatabase<Schema>; client: Client }

const cache = new Map<string, NodeDbHandle>()

export const createNodeDbHandle = (url: string): NodeDbHandle => {
    const existing = cache.get(url)
    if (existing) return existing

    const client = createClient({ url })
    const db = drizzle(client, { schema, casing: 'snake_case' })
    const handle = { db, client }
    cache.set(url, handle)
    return handle
}

export const createNodeDb = (url: string): DbConnection => createNodeDbHandle(url).db as DbConnection
