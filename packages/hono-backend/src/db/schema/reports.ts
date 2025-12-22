import { pgTable, varchar, serial, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { createInsertSchema } from 'drizzle-zod'
import { z } from 'zod'

import { lines } from './lines'
import { stations } from './stations'

export const sourceEnum = pgEnum('source', ['mini_app', 'web_app', 'mobile_app', 'telegram'])

export const reports = pgTable('reports', {
    reportId: serial().primaryKey(),
    stationId: varchar({ length: 16 })
        .notNull()
        .references(() => stations.id),
    lineId: varchar({ length: 16 }).references(() => lines.id),
    directionId: varchar({ length: 16 }).references(() => stations.id),
    timestamp: timestamp().notNull().defaultNow(),
    source: sourceEnum().notNull(),
})

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
