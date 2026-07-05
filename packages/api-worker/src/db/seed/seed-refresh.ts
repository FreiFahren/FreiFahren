/**
 * Live-fetch entry point. Hits Overpass and stores the raw response in the
 * bundled snapshot JSON files under `snapshots/<city>/`. Does not touch seed
 * tables (e.g. stations) — the apply path (`bun db:seed`) reads the bundled
 * snapshots and runs the transforms.
 *
 * Run this manually when the OSM snapshot should be refreshed:
 *   bun db:seed:refresh --city <slug>   (defaults to berlin)
 * Safe to retry — the existing snapshots are left untouched until all new
 * fetches succeed.
 */

import { parseCityArg } from './city-arg'
// Type-only import: erased at build, so it does not evaluate the Overpass module
// (and its registry-backed config) before SEED_CITY is set below.
import type { OsmElement, OsmRelation } from './stations/overpass'

type OsmSnapshotKind = 'stations' | 'route_geometries'

const countRouteRelations = (elements: OsmElement[]): number => {
    let count = 0
    for (const el of elements) {
        if (el.type !== 'relation') continue
        const rel = el as OsmRelation
        if ((rel.tags ?? {}).type === 'route') count++
    }
    return count
}

const refresh = async () => {
    const city = parseCityArg()
    // Select the city before importing the Overpass module, which reads the
    // Registry-backed SEED_CONFIG at import time (see ./config).
    process.env.SEED_CITY = city

    const { fetchRouteGeometryElements, fetchStationElements } = await import('./stations/overpass')

    const writeSnapshot = async (kind: OsmSnapshotKind, raw: unknown) => {
        const fileUrl = new URL(`./snapshots/${city}/${kind}.json`, import.meta.url)
        await Bun.write(fileUrl, `${JSON.stringify(raw, null, 2)}\n`)
    }

    console.log(`[seed:refresh] Fetching station elements from Overpass for '${city}'...`)
    const stationElements = await fetchStationElements()
    console.log(`[seed:refresh] Snapshot includes ${countRouteRelations(stationElements)} route relations.`)

    console.log('[seed:refresh] Fetching route geometry from Overpass...')
    const routeGeometryElements = await fetchRouteGeometryElements()
    console.log(
        `[seed:refresh] Geometry snapshot includes ${countRouteRelations(routeGeometryElements)} route relations.`
    )

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
