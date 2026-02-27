import type { DbConnection } from '../../index'
import { stations } from '../../schema/stations'

import { buildDataset } from './build-dataset'
import { mergeProximate } from './merge-proximate'
import { fetchStationElements } from './overpass'

export const seedStations = async (db: DbConnection): Promise<void> => {
    const elements = await fetchStationElements()
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

    await db.insert(stations).values(records).onConflictDoNothing()
    console.log(`[seed:stations] Inserted ${records.length} stations`)
}
