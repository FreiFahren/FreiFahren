import { logger } from '../../common/logger'
import type { DbConnection } from '../index'

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

    logger.info('[seed] Seeding segments...')
    await seedSegmentsFromGeometry(db, variants, stationCoordinates, routeGeometryElements)

    logger.info('[seed] Done.')
}
