import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { lines, lineStations } from './schema/lines'
import { reports } from './schema/reports'
import { segments } from './schema/segments'
import { stations } from './schema/stations'

const connectionString = process.env.DATABASE_URL!

export const client = postgres(connectionString, { prepare: false })
export const db = drizzle(client, {
    schema: { reports, stations, lines, lineStations, segments },
    casing: 'snake_case',
})

export type DbConnection = typeof db

export * from './schema/reports'
export * from './schema/lines'
export * from './schema/stations'
export * from './schema/segments'
