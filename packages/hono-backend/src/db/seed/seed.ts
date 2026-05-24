import { and, eq, notExists, or, sql } from 'drizzle-orm'

import { logger } from '../../common/logger'
import type { DbConnection } from '../index'
import { lineStations } from '../schema/lines'
import { reports } from '../schema/reports'
import { stations } from '../schema/stations'

import { seedLinesFromRelations } from './lines'
import { seedSegmentsFromGeometry } from './segments/index'
import { seedStationsFromElements } from './stations'
import type { OsmElement, OsmRelation } from './stations/overpass'

type OsmSnapshotKind = 'stations' | 'route_geometries'

const loadSnapshot = async <T>(kind: OsmSnapshotKind): Promise<T> => {
    const file = Bun.file(new URL(`./snapshots/${kind}.json`, import.meta.url))
    if (!(await file.exists())) {
        throw new Error(`[seed] Bundled '${kind}' snapshot is missing. Run \`bun db:seed:refresh\` to populate it.`)
    }

    return (await file.json()) as T
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

// Stations that ended up with no line_stations row (e.g. duplicate Alexanderplatz
// Or Hauptbahnhof nodes from different upstream sources) are unreachable in the
// Transit graph and cause NO_PATH_FOUND errors if a report references them.
// Drop them, except where a report still points at the id — keeping user data
// Alive trumps a clean graph.
const pruneOrphanStations = async (db: DbConnection): Promise<void> => {
    const dropped = await db
        .delete(stations)
        .where(
            and(
                notExists(
                    db
                        .select({ ref: sql`1` })
                        .from(lineStations)
                        .where(eq(lineStations.stationId, stations.id))
                ),
                notExists(
                    db
                        .select({ ref: sql`1` })
                        .from(reports)
                        .where(or(eq(reports.stationId, stations.id), eq(reports.directionId, stations.id)))
                )
            )
        )
        .returning({ id: stations.id, name: stations.name })

    if (dropped.length === 0) {
        logger.info('[seed:prune] No orphan stations found')
        return
    }

    logger.warn(`[seed:prune] Dropped ${dropped.length} orphan station(s) with no line associations:`)
    for (const row of dropped) {
        logger.warn(`[seed:prune]   ${row.id} (${row.name})`)
    }
}

export const seedBaseData = async (db: DbConnection) => {
    logger.info('[seed] Loading bundled stations snapshot...')
    const stationElements = await loadSnapshot<OsmElement[]>('stations')
    logger.info(`[seed]   ${stationElements.length} elements`)

    logger.info('[seed] Loading bundled route geometries snapshot...')
    const routeGeometryElements = await loadSnapshot<OsmElement[]>('route_geometries')
    logger.info(`[seed]   ${routeGeometryElements.length} elements`)

    logger.info('[seed] Seeding stations...')
    const { nodeIdToStationId, stationCoordinates } = await seedStationsFromElements(db, stationElements)

    logger.info('[seed] Seeding lines...')
    const routeRelations = extractRouteRelations(stationElements)
    const variants = await seedLinesFromRelations(db, routeRelations, nodeIdToStationId)

    logger.info('[seed] Pruning orphan stations...')
    await pruneOrphanStations(db)

    logger.info('[seed] Seeding segments...')
    await seedSegmentsFromGeometry(db, variants, stationCoordinates, routeGeometryElements)

    logger.info('[seed] Done.')
}
