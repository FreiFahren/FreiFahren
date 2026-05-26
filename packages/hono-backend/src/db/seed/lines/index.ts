import { and, eq, inArray, notExists, notInArray, sql } from 'drizzle-orm'

import { logger } from '../../../common/logger'
import type { DbConnection } from '../../index'
import { lines, lineStations } from '../../schema/lines'
import { reports } from '../../schema/reports'
import type { OsmRelation } from '../stations/overpass'

import { buildLineVariants, type LineVariant } from './build-variants'

export const seedLinesFromRelations = async (
    db: DbConnection,
    relations: OsmRelation[],
    nodeIdToStationId: Map<number, string>
): Promise<LineVariant[]> => {
    const variants = buildLineVariants(relations, nodeIdToStationId)

    if (variants.length === 0) {
        throw new Error('Line seed produced zero variants — aborting')
    }

    const lineRecords = variants.map((v) => ({
        id: v.id,
        name: v.ref,
        type: v.type,
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
        // Upsert instead of TRUNCATE CASCADE so reports referencing existing
        // lines survive a re-seed.
        await tx
            .insert(lines)
            .values(lineRecords)
            .onConflictDoUpdate({
                target: lines.id,
                set: {
                    name: sql`excluded.name`,
                    type: sql`excluded.type`,
                    isCircular: sql`excluded.is_circular`,
                },
            })

        // line_stations is a join table not referenced by anything else, so
        // it's safe to wipe and rebuild for the lines we are re-seeding.
        const newLineIds = lineRecords.map((l) => l.id)
        await tx.delete(lineStations).where(inArray(lineStations.lineId, newLineIds))
        await tx.insert(lineStations).values(lineStationRecords)

        // Drop lines no longer in the snapshot, but keep ones still
        // referenced by reports. Cascading FKs from segments and
        // line_stations clean themselves up.
        await tx.delete(lines).where(
            and(
                notInArray(lines.id, newLineIds),
                notExists(
                    tx
                        .select({ ref: sql`1` })
                        .from(reports)
                        .where(eq(reports.lineId, lines.id))
                )
            )
        )
    })

    logger.info(
        `[seed:lines] Inserted ${lineRecords.length} line variants, ${lineStationRecords.length} line_stations rows`
    )

    return variants
}
