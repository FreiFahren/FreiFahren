import { and, eq, notExists, or, sql } from 'drizzle-orm'

import { logger } from '../../common/logger'
import type { DbConnection } from '../index'
import { lineStations } from '../schema/lines'
import { reports } from '../schema/reports'
import { stations } from '../schema/stations'

import { SEED_CITY } from './config'
import { seedLinesFromRelations } from './lines'
import { seedSegmentsFromGeometry } from './segments/index'
import { seedStationsFromElements } from './stations'
import type { OsmElement, OsmRelation } from './stations/overpass'

type OsmSnapshotKind = 'stations' | 'route_geometries'

const loadSnapshot = async <T>(kind: OsmSnapshotKind): Promise<T> => {
    const file = Bun.file(new URL(`./snapshots/${SEED_CITY}/${kind}.json`, import.meta.url))
    if (!(await file.exists())) {
        throw new Error(
            `[seed] Bundled '${kind}' snapshot for '${SEED_CITY}' is missing. ` +
                `Run \`bun db:seed:refresh --city ${SEED_CITY}\` to populate it.`
        )
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
// Transit graph and cause NO_PATH_FOUND errors if a report references them. Drop
// The line-less ones, but never a station a report still points at — so seeding
// Can never orphan a report (the seed builds a fresh, report-less DB anyway; this
// Guard just keeps the builder safe if ever run against a DB that has reports).
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
