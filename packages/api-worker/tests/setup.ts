import { applyD1Migrations, env } from 'cloudflare:test'

import { createD1Db, stations } from '../src/db'
import { seedBaseData, setSnapshotLoader, type OsmSnapshotKind } from '../src/db/seed/seed'

// Bundled-import snapshot loader for the Workers runtime (no filesystem). The Bun seed CLI injects
// an fs-based loader instead; both feed the same seedBaseData pipeline. Tests are berlin-only (the
// default city), so the berlin snapshots are imported lazily (dynamic import) — setup files that
// skip the guarded seed below never pay the cost of parsing the ~21MB geometry snapshot.
setSnapshotLoader(async <T>(kind: OsmSnapshotKind): Promise<T> => {
    const snapshot =
        kind === 'stations'
            ? (await import('../src/db/seed/snapshots/berlin/stations.json')).default
            : (await import('../src/db/seed/snapshots/berlin/route_geometries.json')).default
    return snapshot as unknown as T
})

// Runs once per worker: create the schema, then seed the read-only reference tables
// (stations, lines, line_stations, segments) into the shared D1 instance. Guarded so a
// re-imported setup module doesn't re-run the expensive seed against already-seeded data.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)

const db = createD1Db(env.DB)
const [alreadySeeded] = await db.select({ id: stations.id }).from(stations).limit(1)
if (alreadySeeded === undefined) {
    await seedBaseData(db)
}
