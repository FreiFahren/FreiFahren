import { and, eq, inArray, notExists, sql } from 'drizzle-orm'

import { logger } from '../../../common/logger'
import type { DbConnection } from '../../index'
import { lines, lineStations } from '../../schema/lines'
import { reports } from '../../schema/reports'
import { chunkRowsForInsert, chunkValues } from '../batch'
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
        color: v.color,
    }))

    const lineStationRecords = variants.flatMap((v) =>
        v.stationIds.map((stationId, order) => ({
            lineId: v.id,
            stationId,
            order,
        }))
    )

    // Sequential, chunked statements rather than an interactive transaction: the seed is
    // Idempotent and offline, and the D1 driver (used by the test runtime) has no BEGIN/COMMIT and
    // A low bound-parameter ceiling. Upsert instead of TRUNCATE CASCADE so reports referencing
    // Existing lines survive a re-seed.
    for (const batch of chunkRowsForInsert(lineRecords, 5)) {
        await db
            .insert(lines)
            .values(batch)
            .onConflictDoUpdate({
                target: lines.id,
                set: {
                    name: sql`excluded.name`,
                    type: sql`excluded.type`,
                    isCircular: sql`excluded.is_circular`,
                    color: sql`excluded.color`,
                },
            })
    }

    // The line_stations join table is referenced by nothing else, so it is safe to wipe and rebuild for the lines we are re-seeding.
    const newLineIds = lineRecords.map((l) => l.id)
    for (const batch of chunkValues(newLineIds)) {
        await db.delete(lineStations).where(inArray(lineStations.lineId, batch))
    }
    for (const batch of chunkRowsForInsert(lineStationRecords, 3)) {
        await db.insert(lineStations).values(batch)
    }

    // Drop lines no longer in the snapshot, but keep ones still referenced by reports.
    // Cascading FKs from segments and line_stations clean themselves up. Obsolete ids are computed
    // In memory so the delete binds only the removal set, not every current line id.
    const newLineIdSet = new Set(newLineIds)
    const existingLineIds = await db.select({ id: lines.id }).from(lines)
    const obsoleteLineIds = existingLineIds.map((row) => row.id).filter((id) => !newLineIdSet.has(id))
    for (const batch of chunkValues(obsoleteLineIds)) {
        await db.delete(lines).where(
            and(
                inArray(lines.id, batch),
                notExists(
                    db
                        .select({ ref: sql`1` })
                        .from(reports)
                        .where(eq(reports.lineId, lines.id))
                )
            )
        )
    }

    logger.info(
        `[seed:lines] Inserted ${lineRecords.length} line variants, ${lineStationRecords.length} line_stations rows`
    )

    return variants
}
