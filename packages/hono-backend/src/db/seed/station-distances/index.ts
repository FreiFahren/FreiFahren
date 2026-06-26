import { asc } from 'drizzle-orm'

import { NoPathFoundError } from '../../../common/errors'
import { logger } from '../../../common/logger'
import { buildGraph, findPathWithAStar } from '../../../modules/transit/pathfinding'
import { type DbConnection, lines, lineStations, stationDistances, stations } from '../../index'

const INSERT_BATCH_SIZE = 1000

export const rebuildStationDistances = async (db: DbConnection) => {
    logger.info('[seed] Rebuilding station distances...')

    const allStations = await db.select().from(stations)
    const allLineStations = await db
        .select()
        .from(lineStations)
        .orderBy(asc(lineStations.lineId), asc(lineStations.order))
    const allLines = await db.select().from(lines)

    const graph = buildGraph(allStations, allLines, allLineStations)
    const stationIds = allStations.map((station) => station.id)

    const rows: Array<{ fromStationId: string; toStationId: string; distance: number }> = []

    for (const from of stationIds) {
        for (const to of stationIds) {
            if (from === to) {
                continue
            }

            try {
                const distance = findPathWithAStar(graph, from, to)
                rows.push({ fromStationId: from, toStationId: to, distance })
            } catch (error) {
                if (!(error instanceof NoPathFoundError)) {
                    throw error
                }
            }
        }
    }

    await db.delete(stationDistances)

    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + INSERT_BATCH_SIZE)
        await db.insert(stationDistances).values(batch)
    }

    logger.info(`[seed]   ${rows.length} station distance pairs`)
}
