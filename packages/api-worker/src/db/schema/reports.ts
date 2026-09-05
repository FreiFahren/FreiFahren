import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
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
        // Opaque intake metadata used by the private report gate.
        asn: integer(),
        asOrganization: text(),
        uaFamily: text({ length: 32 }),
        clientHash: text({ length: 32 }),
        // 0 is pending; null preserves the legacy pre-gate meaning.
        trust: real(),
        // Private diagnostic detail written by the report gate and never returned by the API.
        trustFlags: text(),
    },
    // Reads filter by a time window, often scoped to a station or line; the leading
    // Equality column lets the range predicate use an index seek instead of a full scan.
    (table) => [
        index('reports_station_ts_idx').on(table.stationId, table.timestamp),
        index('reports_ts_idx').on(table.timestamp),
        index('reports_line_ts_idx').on(table.lineId, table.timestamp),
        index('reports_client_ts_idx').on(table.clientHash, table.timestamp),
    ]
)

const insertReportDbSchema = createInsertSchema(reports).pick({
    stationId: true,
    lineId: true,
    directionId: true,
    source: true,
})

// API input schema:
// - Allows missing stationId so normalization can infer it
// - Defaults public submissions to web_app; Telegram uses private RPC
// - Requires at least one of stationId, lineId, or directionId
export const insertReportSchema = insertReportDbSchema
    .extend({
        source: z.enum(['mini_app', 'web_app', 'mobile_app']).default('web_app'),
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
