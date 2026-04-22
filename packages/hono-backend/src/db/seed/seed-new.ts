/**
 * Apply-path seed. Reads pre-fetched Overpass responses from the `osm_snapshot`
 * table and writes them into the seed tables.
 *
 * Bootstrap: a brand-new database has an empty `osm_snapshot` table. Run
 * `bun db:seed:refresh` once after provisioning to populate it. Subsequent
 * deploys just re-apply whatever snapshot is there.
 */

import { eq } from 'drizzle-orm'

import { db } from '../index'
import { osmSnapshot, type OsmSnapshotKind } from '../schema/osm-snapshot'

import { seedLinesFromRelations } from './lines'
import { seedSegmentsFromGeometry } from './segments/index'
import { seedStationsFromElements } from './stations'
import type { OsmElement, OsmRelation } from './stations/overpass'

const loadSnapshot = async <T>(kind: OsmSnapshotKind): Promise<T> => {
    const rows = await db.select().from(osmSnapshot).where(eq(osmSnapshot.queryKind, kind)).limit(1)
    if (rows.length === 0) {
        throw new Error(`[seed] osm_snapshot has no '${kind}' row. Run \`bun db:seed:refresh\` to populate it.`)
    }
    return rows[0].raw as T
}

const extractRouteRelations = (elements: OsmElement[]): OsmRelation[] => {
    const out: OsmRelation[] = []
    for (const el of elements) {
        if (el.type !== 'relation') continue
        const rel = el as OsmRelation
        if (rel.tags?.type === 'route') out.push(rel)
    }
    return out
}

const seed = async () => {
    console.log('[seed] Loading stations snapshot from osm_snapshot...')
    const stationElements = await loadSnapshot<OsmElement[]>('stations')
    console.log(`[seed]   ${stationElements.length} elements`)

    console.log('[seed] Loading route geometries snapshot from osm_snapshot...')
    const routeGeometryElements = await loadSnapshot<OsmElement[]>('route_geometries')
    console.log(`[seed]   ${routeGeometryElements.length} elements`)

    console.log('[seed] Seeding stations...')
    const { nodeIdToStationId, stationCoordinates } = await seedStationsFromElements(db, stationElements)

    console.log('[seed] Seeding lines...')
    const routeRelations = extractRouteRelations(stationElements)
    const variants = await seedLinesFromRelations(db, routeRelations, nodeIdToStationId)

    console.log('[seed] Seeding segments...')
    await seedSegmentsFromGeometry(db, variants, stationCoordinates, routeGeometryElements)

    console.log('[seed] Done.')
}

seed()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => {
        console.error('[seed] Failed:', error)
        process.exit(1)
    })
