import { jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core'

/**
 * Cached raw Overpass responses. One row per query kind. Populated by
 * `bun db:seed:refresh`; consumed by `bun db:seed` so the apply path has
 * zero external dependencies.
 */
export const osmSnapshot = pgTable('osm_snapshot', {
    queryKind: varchar({ length: 32 }).primaryKey(),
    raw: jsonb().notNull(),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export type OsmSnapshotKind = 'stations'
