import { sql } from 'drizzle-orm'
import { integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'

import { reports } from './reports'

export const reportModeration = sqliteTable('report_moderation', {
    id: integer().primaryKey(),
    enabled: integer({ mode: 'boolean' }).notNull().default(false),
    changedAt: integer().notNull(),
})

export const reportQuarantines = sqliteTable('report_quarantines', {
    reportId: integer()
        .primaryKey()
        .references(() => reports.reportId, { onDelete: 'cascade' }),
    originalTrust: real(),
    quarantinedAt: integer()
        .notNull()
        .default(sql`(unixepoch() * 1000)`),
})

export const reportModerationEvents = sqliteTable('report_moderation_events', {
    id: integer().primaryKey({ autoIncrement: true }),
    enabled: integer({ mode: 'boolean' }).notNull(),
    timestamp: integer().notNull(),
})
