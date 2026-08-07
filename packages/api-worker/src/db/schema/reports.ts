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
        /*
         * Client attribution, derived at intake — never accepted from the request body, so a
         * caller cannot label itself. Null for telegram-relayed reports, which arrive
         * server-to-server with no browser behind them, and null everywhere until
         * CLIENT_HASH_SECRET is set.
         *
         * The network, as Cloudflare resolved it. An ASN identifies a carrier, not a person,
         * which is the same line the Turnstile logging draws.
         */
        asn: integer(),
        /*
         * A label, never a grouping key. One network reports under several names: AS3209 arrives as
         * both "Vodafone GmbH" and "Kabel Deutschland Vertrieb und Service GmbH", AS3320 as both
         * "Deutsche Telekom AG" and "Telekom Deutschland GmbH". Grouping on this splits one carrier
         * into several and understates each — quietly, with a result that still looks plausible.
         * Group by asn and use this only to read a row.
         */
        asOrganization: text(),
        /*
         * Coarse browser+OS family ('Chrome/140 Android'), from a fixed vocabulary. Enough to tell
         * a headless stack from a real phone without keeping the full fingerprint.
         */
        uaFamily: text({ length: 32 }),
        /*
         * See client-identity.ts: HMAC over ip+ua+asn under a rotating salt. The raw address is
         * never stored, and the rotation means the value stops linking after the period ends.
         */
        clientHash: text({ length: 32 }),
        /*
         * How much this report counts on its own, in (0, 1]. Assigned after the write by the flags
         * in trust.ts, so null means *not yet scored* rather than untrusted. Nothing that reads this
         * may conflate the two: during an outage of the scorer every report is null, and treating
         * that as untrusted would empty the map.
         */
        trust: real(),
        /*
         * Which flags fired, comma-separated. Kept so a score can be explained later without
         * re-running the flags against a database that has moved on since.
         */
        trustFlags: text(),
    },
    // Reads filter by a time window, often scoped to a station or line; the leading
    // Equality column lets the range predicate use an index seek instead of a full scan.
    (table) => [
        index('reports_station_ts_idx').on(table.stationId, table.timestamp),
        index('reports_ts_idx').on(table.timestamp),
        index('reports_line_ts_idx').on(table.lineId, table.timestamp),
        /*
         * Abuse analysis reads a single client's recent history ("what else did this client
         * file?"), which is the same shape as the station/line indexes above.
         */
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
