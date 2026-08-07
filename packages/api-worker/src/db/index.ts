import { drizzle } from 'drizzle-orm/d1'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

import { lines, lineStations } from './schema/lines'
import { reports } from './schema/reports'
import { segments } from './schema/segments'
import { stations } from './schema/stations'

export const schema = { reports, stations, lines, lineStations, segments }
export type Schema = typeof schema

// Every context — the Worker, the Vitest suite, and the seed CLI (via getPlatformProxy) — uses the
// D1 driver over the same schema. The concrete result-type generic is widened here since the app
// only ever uses the query builder.
export type DbConnection = BaseSQLiteDatabase<'async', unknown, Schema>

// Workers talk to D1 through the `DB` binding. No client lifecycle: unlike postgres.js there is
// Nothing to open or close per request — the binding is the connection.
export const createD1Db = (d1: D1Database): DbConnection =>
    drizzle(d1, { schema, casing: 'snake_case' }) as unknown as DbConnection

export * from './schema/reports'
export * from './schema/lines'
export * from './schema/stations'
export * from './schema/segments'
