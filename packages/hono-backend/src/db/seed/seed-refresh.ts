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

import { SEED_CONFIG } from './config'
import { fetchStationElements, type OsmElement, type OsmRelation } from './stations/overpass'

const upsertSnapshot = async (kind: OsmSnapshotKind, raw: unknown) => {
    await db
        .insert(osmSnapshot)
        .values({ queryKind: kind, raw })
        .onConflictDoUpdate({
            target: osmSnapshot.queryKind,
            set: { raw, fetchedAt: new Date() },
        })
}

const assertAllRefsPresent = (elements: OsmElement[]) => {
    const seen = new Set<string>()
    for (const el of elements) {
        if (el.type !== 'relation') continue
        const rel = el as OsmRelation
        const tags: Record<string, string | undefined> = rel.tags ?? {}
        if (tags.type !== 'route') continue
        const ref = tags.ref
        if (ref !== undefined && ref !== '') seen.add(ref)
    }
    const missing = SEED_CONFIG.lines.filter((ref) => !seen.has(ref))
    if (missing.length > 0) {
        throw new Error(
            `[seed:refresh] Overpass response is missing route relations for refs: ${missing.join(', ')}. ` +
                `Existing snapshot left untouched. Re-run \`bun db:seed:refresh\` (Overpass occasionally ` +
                `returns a truncated-but-200 body under load; a few retries usually clears it).`
        )
    }
}

const refresh = async () => {
    console.log('[seed:refresh] Fetching station elements from Overpass...')
    const stationElements = await fetchStationElements()

    assertAllRefsPresent(stationElements)
    console.log(`[seed:refresh] All ${SEED_CONFIG.lines.length} configured refs present in response.`)

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
