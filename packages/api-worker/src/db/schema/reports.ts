import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema } from 'drizzle-zod'
import { z } from 'zod'

import { lines } from './lines'
import { stations } from './stations'

export const REPORT_SOURCES = ['mini_app', 'web_app', 'mobile_app', 'telegram'] as const

export const reports = sqliteTable(
    'reports',
    {
        reportId: integer().primaryKey({ autoIncrement: true }),
        stationId: text({ length: 16 })
            .notNull()
            .references(() => stations.id),
        lineId: text({ length: 16 }).references(() => lines.id),
        directionId: text({ length: 16 }).references(() => stations.id),
        // Millisecond resolution (matches the explicit `new Date()` set on every insert) so that
        // "latest report" ordering stays deterministic — second resolution ties across same-second
        // Reports and breaks the risk/prediction reads.
        timestamp: integer({ mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(unixepoch() * 1000)`),
        source: text({ enum: REPORT_SOURCES }).notNull(),
    },
    // Every read filters reports by a time window, often also scoped to a station or line.
    // Without these indexes each risk/reports request full-scans the table (~103k rows and
    // Growing). Leading with the equality column makes the time-range predicate a covered
    // Range seek instead of a full scan.
    (table) => [
        index('reports_station_ts_idx').on(table.stationId, table.timestamp),
        index('reports_ts_idx').on(table.timestamp),
        index('reports_line_ts_idx').on(table.lineId, table.timestamp),
    ]
)

const insertReportDbSchema = createInsertSchema(reports).pick({
    stationId: true,
    lineId: true,
    directionId: true,
    source: true,
})

// API input schema:
// - Allows missing stationId (bot sometimes cannot detect it)
// - Allows missing source (we default to telegram)
// - Requires at least one of stationId, lineId, or directionId
export const insertReportSchema = insertReportDbSchema
    .extend({
        source: insertReportDbSchema.shape.source.optional(),
        stationId: insertReportDbSchema.shape.stationId.optional(),
    })
    .superRefine((data, ctx) => {
        if (data.stationId === undefined && data.lineId === undefined && data.directionId === undefined) {
            ctx.addIssue({
                code: 'custom',
                message: 'At least one of stationId, lineId, or directionId must be provided',
                path: [],
            })
        }
    })

// Database insert type (internal use): stationId + source are required
export type InsertReport = z.infer<typeof insertReportDbSchema>
