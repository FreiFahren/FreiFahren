import { and, eq, notExists, or, sql } from 'drizzle-orm'

import { logger } from '../../common/logger'
import type { DbConnection } from '../index'
import { lineStations } from '../schema/lines'
import { reports } from '../schema/reports'
import { stations } from '../schema/stations'

import { SEED_CONFIG } from './config'
import { seedLinesFromRelations } from './lines'
import { seedSegmentsFromGeometry } from './segments/index'
import { seedStationsFromElements } from './stations'
import type { OsmElement, OsmRelation } from './stations/overpass'

export type OsmSnapshotKind = 'stations' | 'route_geometries'

// Loads a bundled OSM snapshot. Injected rather than reading the filesystem directly so the same
// Seed runs under the Node/tsx seed CLI (fs loader) and inside the Workers test runtime
// (bundled-import loader) — neither runtime shares the other's file API.
export type SnapshotLoader = <T>(kind: OsmSnapshotKind) => Promise<T>

let snapshotLoader: SnapshotLoader | null = null

export const setSnapshotLoader = (loader: SnapshotLoader) => {
    snapshotLoader = loader
}

const loadSnapshot = async <T>(kind: OsmSnapshotKind): Promise<T> => {
    if (snapshotLoader === null) {
        throw new Error('[seed] No snapshot loader registered — call setSnapshotLoader() before seedBaseData()')
    }
    return snapshotLoader<T>(kind)
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

const filterStationElementsToBounds = (elements: OsmElement[]): OsmElement[] => {
    const bounds = SEED_CONFIG.stationBounds
    if (bounds === undefined) return elements

    const [west, south, east, north] = bounds
    return elements.filter(
        (element) =>
            element.type !== 'node' ||
            (element.lon >= west && element.lon <= east && element.lat >= south && element.lat <= north)
    )
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
    const rawStationElements = await loadSnapshot<OsmElement[]>('stations')
    const stationElements = filterStationElementsToBounds(rawStationElements)
    logger.info(`[seed]   ${rawStationElements.length} elements → ${stationElements.length} within city service area`)

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
