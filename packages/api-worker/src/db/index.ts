import { drizzle } from 'drizzle-orm/d1'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

import { lines, lineStations } from './schema/lines'
import { reports } from './schema/reports'
import { segments } from './schema/segments'
import { stations } from './schema/stations'

export const schema = { reports, stations, lines, lineStations, segments }
export type Schema = typeof schema

// Both runtime drivers (D1 on Workers, libsql on Node for tests/seed) produce an async
// BaseSQLiteDatabase over the same schema, so every query in the app is dialect-identical.
// The concrete result-type generic differs per driver; the app only uses the query builder,
// So we widen it here and the Node provider casts its libsql client to this type.
export type DbConnection = BaseSQLiteDatabase<'async', unknown, Schema>

// Workers talk to D1 through the `DB` binding. No client lifecycle: unlike postgres.js there is
// Nothing to open or close per request — the binding is the connection.
export const createD1Db = (d1: D1Database): DbConnection =>
    drizzle(d1, { schema, casing: 'snake_case' }) as unknown as DbConnection

export * from './schema/reports'
export * from './schema/lines'
export * from './schema/stations'
export * from './schema/segments'
