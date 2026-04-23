/**
 * Live-fetch entry point. Hits Overpass and stores the raw response in the
 * bundled snapshot JSON files. Does not touch seed tables (e.g. stations) —
 * the apply path (`bun db:seed`) reads the bundled snapshots and runs the
 * transforms.
 *
 * Run this manually when the OSM snapshot should be refreshed. Safe to retry —
 * the existing snapshots are left untouched until all new fetches succeed.
 */

import { SEED_CONFIG } from './config'
import {
    fetchRouteGeometryElements,
    fetchStationElements,
    type OsmElement,
    type OsmRelation,
} from './stations/overpass'

type OsmSnapshotKind = 'stations' | 'route_geometries'

const writeSnapshot = async (kind: OsmSnapshotKind, raw: unknown) => {
    const fileUrl = new URL(`./snapshots/${kind}.json`, import.meta.url)
    await Bun.write(fileUrl, `${JSON.stringify(raw, null, 2)}\n`)
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

    console.log('[seed:refresh] Fetching route geometry from Overpass...')
    const routeGeometryElements = await fetchRouteGeometryElements()

    assertAllRefsPresent(routeGeometryElements)
    console.log(`[seed:refresh] Geometry snapshot includes all ${SEED_CONFIG.lines.length} configured refs.`)

    await writeSnapshot('stations', stationElements)
    console.log(`[seed:refresh] Wrote 'stations' snapshot (${stationElements.length} elements)`)

    await writeSnapshot('route_geometries', routeGeometryElements)
    console.log(`[seed:refresh] Wrote 'route_geometries' snapshot (${routeGeometryElements.length} elements)`)
}

refresh()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => {
        console.error('[seed:refresh] Failed:', error)
        process.exit(1)
    })
