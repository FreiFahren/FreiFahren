import { sql } from 'drizzle-orm'

import type { DbConnection } from '../../index'
import { stations } from '../../schema/stations'

import { buildDataset } from './build-dataset'
import { mergeProximate } from './merge-proximate'
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

export const seedStationsFromElements = async (db: DbConnection, rawElements: OsmElement[]): Promise<void> => {
    const elements = deduplicateElements(rawElements)
    console.log(`[seed:stations] ${rawElements.length} raw → ${elements.length} deduplicated elements`)
    const dataset = buildDataset(elements)
    const merged = mergeProximate(dataset)

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
    console.log(`[seed:stations] Inserted ${records.length} stations`)
}
