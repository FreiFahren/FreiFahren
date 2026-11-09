import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// One precomputed statistics response per period, overwritten on every refresh.
export const reportStatistics = sqliteTable('report_statistics', {
    period: text().primaryKey(),
    computedAt: integer().notNull(),
    payload: text().notNull(),
})

// A row means some worker is recomputing that period, so others serve the old snapshot or wait.
export const reportStatisticsRefreshes = sqliteTable('report_statistics_refreshes', {
    period: text().primaryKey(),
    startedAt: integer().notNull(),
})
