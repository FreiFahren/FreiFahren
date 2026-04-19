/**
 * Live-fetch entry point. Hits Overpass and stores the raw response in the
 * `osm_snapshot` table. Does not touch seed tables (e.g. stations) — the apply
 * path (`bun db:seed`) reads from `osm_snapshot` and runs the transforms.
 *
 * Run this manually when the OSM snapshot should be refreshed. Safe to retry —
 * the existing snapshot is left untouched until a new fetch succeeds.
 */

import { db } from '../index'
import { osmSnapshot, type OsmSnapshotKind } from '../schema/osm-snapshot'

import { fetchStationElements } from './stations/overpass'

const upsertSnapshot = async (kind: OsmSnapshotKind, raw: unknown) => {
    await db
        .insert(osmSnapshot)
        .values({ queryKind: kind, raw })
        .onConflictDoUpdate({
            target: osmSnapshot.queryKind,
            set: { raw, fetchedAt: new Date() },
        })
}

const refresh = async () => {
    console.log('[seed:refresh] Fetching station elements from Overpass...')
    const stationElements = await fetchStationElements()

    await upsertSnapshot('stations', stationElements)
    console.log(`[seed:refresh] Stored 'stations' snapshot (${stationElements.length} elements)`)
}

refresh()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => {
        console.error('[seed:refresh] Failed:', error)
        process.exit(1)
    })
