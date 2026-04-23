import { sql } from 'drizzle-orm'

import { logger } from '../../../common/logger'
import type { DbConnection } from '../../index'
import { stations } from '../../schema/stations'

import { buildDataset } from './build-dataset'
import { mergeProximate, type Coordinates } from './merge-proximate'
import type { OsmElement, OsmNode, OsmRelation } from './overpass'

const mergeRelationMembers = (existing: OsmRelation, rel: OsmRelation) => {
    const seen = new Set(existing.members.map((m) => `${m.type}:${m.ref}:${m.role}`))
    for (const m of rel.members) {
        if (!seen.has(`${m.type}:${m.ref}:${m.role}`)) {
            existing.members.push(m)
        }
    }
}

// Batched fetching returns overlapping elements — deduplicate by type+id.
// For relations, merge members from duplicates so line associations aren't lost.
const deduplicateElements = (elements: OsmElement[]): OsmElement[] => {
    const nodes = new Map<number, OsmNode>()
    const relations = new Map<number, OsmRelation>()
    const other: OsmElement[] = []

    for (const el of elements) {
        if (el.type === 'node') {
            nodes.set(el.id, el as OsmNode)
        } else if (el.type === 'relation') {
            const rel = el as OsmRelation
            const existing = relations.get(rel.id)
            if (existing) {
                mergeRelationMembers(existing, rel)
            } else {
                relations.set(rel.id, rel)
            }
        } else {
            other.push(el)
        }
    }

    return [...nodes.values(), ...relations.values(), ...other]
}

export interface StationSeedResult {
    /** Raw OSM node id → `stations.id` that node ended up under (post-merge). */
    nodeIdToStationId: Map<number, string>
    stationCoordinates: Map<string, Coordinates>
}

export const seedStationsFromElements = async (
    db: DbConnection,
    rawElements: OsmElement[]
): Promise<StationSeedResult> => {
    const elements = deduplicateElements(rawElements)
    logger.info(`[seed:stations] ${rawElements.length} raw → ${elements.length} deduplicated elements`)
    const { dataset, nodeIdToCode } = buildDataset(elements)
    const { merged, codeRemap } = mergeProximate(dataset)

    if (merged.size === 0) {
        throw new Error('Station seed produced zero stations — aborting')
    }

    const records = Array.from(merged.entries()).map(([id, entry]) => ({
        id,
        name: entry.name,
        lat: entry.coordinates.latitude,
        lng: entry.coordinates.longitude,
    }))

    await db.transaction(async (tx) => {
        await tx.execute(sql`TRUNCATE stations CASCADE`)
        await tx.insert(stations).values(records)
    })
    logger.info(`[seed:stations] Inserted ${records.length} stations`)

    const nodeIdToStationId = new Map<number, string>()
    for (const [nodeId, code] of nodeIdToCode) {
        nodeIdToStationId.set(nodeId, codeRemap.get(code) ?? code)
    }

    const stationCoordinates = new Map<string, Coordinates>()
    for (const [stationId, entry] of merged) {
        stationCoordinates.set(stationId, entry.coordinates)
    }

    return { nodeIdToStationId, stationCoordinates }
}
