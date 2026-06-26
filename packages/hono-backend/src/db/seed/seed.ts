import { and, eq, exists, inArray, notExists, or, sql, type InferSelectModel } from 'drizzle-orm'

import { logger } from '../../common/logger'
import type { DbConnection } from '../index'
import { lineStations } from '../schema/lines'
import { reports } from '../schema/reports'
import { stations } from '../schema/stations'

import { SEED_CONFIG } from './config'
import { seedLinesFromRelations } from './lines'
import { seedSegmentsFromGeometry } from './segments/index'
import { rebuildStationDistances } from './station-distances'
import { seedStationsFromElements } from './stations'
import { haversine, stationNamesMatch } from './stations/merge-proximate'
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

type OrphanStation = InferSelectModel<typeof stations>

type ReplacementCandidate = OrphanStation & {
    lineIds: string[]
}

type ReplacementCandidateRow = OrphanStation & {
    lineId: string
}

const getReplacementCandidates = async (db: DbConnection, orphan: OrphanStation): Promise<ReplacementCandidate[]> => {
    const rows: ReplacementCandidateRow[] = await db
        .select({
            id: stations.id,
            name: stations.name,
            lat: stations.lat,
            lng: stations.lng,
            lineId: lineStations.lineId,
        })
        .from(stations)
        .innerJoin(lineStations, eq(lineStations.stationId, stations.id))

    const byId = new Map<string, ReplacementCandidate>()
    for (const row of rows) {
        if (row.id === orphan.id) continue
        if (stationNamesMatch(orphan.name, row.name) === false) continue
        const distanceMeters = haversine(
            { latitude: orphan.lat, longitude: orphan.lng },
            { latitude: row.lat, longitude: row.lng }
        )
        if (distanceMeters > SEED_CONFIG.mergeThresholdMeters) continue

        const candidate = byId.get(row.id) ?? {
            id: row.id,
            name: row.name,
            lat: row.lat,
            lng: row.lng,
            lineIds: [],
        }
        candidate.lineIds.push(row.lineId)
        byId.set(row.id, candidate)
    }

    return Array.from(byId.values())
}

const logUnresolvedOrphanReportReferences = ({
    orphan,
    reportIds,
    lineId,
    candidates,
}: {
    orphan: OrphanStation
    reportIds: number[]
    lineId: string | null
    candidates: ReplacementCandidate[]
}) => {
    const candidateIds = candidates.map((candidate) => candidate.id).sort()
    logger.warn(
        {
            orphanStationId: orphan.id,
            orphanStationName: orphan.name,
            reportIds,
            reportCount: reportIds.length,
            lineId,
            candidateIds,
        },
        '[seed:repair] Could not remap orphan station report references'
    )
}

const remapReportReferences = async ({
    db,
    orphan,
    field,
    candidates,
}: {
    db: DbConnection
    orphan: OrphanStation
    field: 'stationId' | 'directionId'
    candidates: ReplacementCandidate[]
}): Promise<number> => {
    const reportRows = await db
        .select({ reportId: reports.reportId, lineId: reports.lineId })
        .from(reports)
        .where(eq(reports[field], orphan.id))

    const reportIdsByLineId = new Map<string | null, number[]>()
    for (const report of reportRows) {
        const group = reportIdsByLineId.get(report.lineId) ?? []
        group.push(report.reportId)
        reportIdsByLineId.set(report.lineId, group)
    }

    let remapped = 0
    for (const [lineId, reportIds] of reportIdsByLineId) {
        const lineCandidates =
            lineId === null ? candidates : candidates.filter((candidate) => candidate.lineIds.includes(lineId))

        if (lineCandidates.length !== 1) {
            logUnresolvedOrphanReportReferences({ orphan, reportIds, lineId, candidates: lineCandidates })
            continue
        }

        const [candidate] = lineCandidates
        const updated = await db
            .update(reports)
            .set({ [field]: candidate.id })
            .where(inArray(reports.reportId, reportIds))
            .returning({ reportId: reports.reportId })

        remapped += updated.length
        logger.info(
            {
                orphanStationId: orphan.id,
                replacementStationId: candidate.id,
                reportCount: updated.length,
                reportField: field,
                lineId,
            },
            '[seed:repair] Remapped orphan station report references'
        )
    }

    return remapped
}

const deleteReportsForOrphanStations = async (db: DbConnection): Promise<number> => {
    const orphanIds = await db
        .select({ id: stations.id })
        .from(stations)
        .where(
            notExists(
                db
                    .select({ ref: sql`1` })
                    .from(lineStations)
                    .where(eq(lineStations.stationId, stations.id))
            )
        )

    if (orphanIds.length === 0) return 0

    const ids = orphanIds.map((row) => row.id)
    const deleted = await db
        .delete(reports)
        .where(or(inArray(reports.stationId, ids), inArray(reports.directionId, ids)))
        .returning({ reportId: reports.reportId })

    if (deleted.length > 0) {
        logger.warn(
            {
                reportCount: deleted.length,
                orphanStationIds: ids,
                reportIds: deleted.map((row) => row.reportId),
            },
            '[seed:repair] Deleted reports still referencing orphan stations'
        )
    }

    return deleted.length
}

const repairReportsForOrphanStations = async (db: DbConnection): Promise<void> => {
    const orphanRows = await db
        .select({
            id: stations.id,
            name: stations.name,
            lat: stations.lat,
            lng: stations.lng,
        })
        .from(stations)
        .where(
            and(
                notExists(
                    db
                        .select({ ref: sql`1` })
                        .from(lineStations)
                        .where(eq(lineStations.stationId, stations.id))
                ),
                exists(
                    db
                        .select({ ref: sql`1` })
                        .from(reports)
                        .where(or(eq(reports.stationId, stations.id), eq(reports.directionId, stations.id)))
                )
            )
        )

    if (orphanRows.length === 0) {
        logger.info('[seed:repair] No referenced orphan stations found')
        return
    }

    let remapped = 0
    for (const orphan of orphanRows) {
        const candidates = await getReplacementCandidates(db, orphan)
        remapped += await remapReportReferences({ db, orphan, field: 'stationId', candidates })
        remapped += await remapReportReferences({ db, orphan, field: 'directionId', candidates })
    }

    const deleted = await deleteReportsForOrphanStations(db)
    logger.info({ orphanStationCount: orphanRows.length, remapped, deleted }, '[seed:repair] Finished orphan repair')
}

// Stations that ended up with no line_stations row (e.g. duplicate Alexanderplatz
// Or Hauptbahnhof nodes from different upstream sources) are unreachable in the
// Transit graph and cause NO_PATH_FOUND errors if a report references them.
// Drop any that are no longer referenced after the report repair step.
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

    logger.info('[seed] Repairing orphan station report references...')
    await repairReportsForOrphanStations(db)

    logger.info('[seed] Pruning orphan stations...')
    await pruneOrphanStations(db)

    logger.info('[seed] Seeding segments...')
    await seedSegmentsFromGeometry(db, variants, stationCoordinates, routeGeometryElements)

    await rebuildStationDistances(db)

    logger.info('[seed] Done.')
}
