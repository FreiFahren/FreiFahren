import { sql } from 'drizzle-orm'

import type { DbConnection } from '../../index'
import { lines, lineStations } from '../../schema/lines'
import type { OsmRelation } from '../stations/overpass'

import { buildLineVariants } from './build-variants'

export const seedLinesFromRelations = async (
    db: DbConnection,
    relations: OsmRelation[],
    nodeIdToStationId: Map<number, string>
): Promise<void> => {
    const variants = buildLineVariants(relations, nodeIdToStationId)

    if (variants.length === 0) {
        throw new Error('Line seed produced zero variants — aborting')
    }

    const lineRecords = variants.map((v) => ({
        id: v.id,
        name: v.ref,
        isCircular: v.isCircular,
    }))

    const lineStationRecords = variants.flatMap((v) =>
        v.stationIds.map((stationId, order) => ({
            lineId: v.id,
            stationId,
            order,
        }))
    )

    await db.transaction(async (tx) => {
        await tx.execute(sql`TRUNCATE lines CASCADE`)
        await tx.insert(lines).values(lineRecords)
        await tx.insert(lineStations).values(lineStationRecords)
    })

    console.log(
        `[seed:lines] Inserted ${lineRecords.length} line variants, ${lineStationRecords.length} line_stations rows`
    )
}
