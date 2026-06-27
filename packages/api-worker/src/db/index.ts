import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { lines, lineStations } from './schema/lines'
import { reports } from './schema/reports'
import { segments } from './schema/segments'
import { stations } from './schema/stations'

// Hyperdrive pools in transaction mode, which has no named prepared statements — hence `prepare: false`.
// Disabling `fetch_types` skips the first-use round-trip postgres.js makes to introspect column types.
//
// Returns the raw client alongside the Drizzle instance so the caller can close it. On Workers a
// postgres.js client is an I/O object bound to the request that created it, so it must be built and
// closed per request — Hyperdrive does the cross-request pooling upstream.
export const createDb = (connectionString: string) => {
    const client = postgres(connectionString, {
        prepare: false,
        fetch_types: false,
        max: 5,
        connect_timeout: 10,
    })

    const db = drizzle(client, {
        schema: { reports, stations, lines, lineStations, segments },
        casing: 'snake_case',
    })

    return { db, client }
}

export type DbConnection = ReturnType<typeof createDb>['db']

export * from './schema/reports'
export * from './schema/lines'
export * from './schema/stations'
export * from './schema/segments'
