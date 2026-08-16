import type { D1Database } from '@cloudflare/workers-types'

import { toSqlLiteral } from '../sql-literal'

interface ReferenceTableSpec {
    /** Natural key an existing remote row is matched on. Never a surrogate id — see below. */
    conflictTarget: readonly string[]
    /** Columns left out of the statement entirely; the remote row keeps its own value. */
    omitColumns?: readonly string[]
    /** Integer column negated to mark rows before the load, so untouched ones can be swept after. */
    sweepMarkerColumn?: string
}

/*
 * How each reference table is reconciled with the freshly built local copy.
 * Parents before children for FK order.
 *
 * `conflictTarget` is deliberately never `segments.id`. That value is assigned by
 * insertion order into a database CI rebuilds from scratch, so it names a different
 * segment whenever the network changes. Writing it as a literal and loading with
 * INSERT OR IGNORE meant any row whose id was already taken remotely was silently
 * discarded — which is how prod ended up serving 21 MetroBus lines with no geometry.
 * Matching on the natural key instead also keeps ids stable for rows that persist,
 * which is what the risk layer uses as its MapLibre feature id.
 *
 * `sweepMarkerColumn` marks a table prunable: a row no longer in the snapshot has to
 * go, or prod keeps drawing a segment for a station pair its line no longer has. Only
 * the derived tables are swept — `reports` references `stations` and `lines` with
 * ON DELETE no action, so pruning those could fail the load or orphan user data.
 */
export const REFERENCE_TABLES: Record<string, ReferenceTableSpec> = {
    stations: { conflictTarget: ['id'] },
    lines: { conflictTarget: ['id'] },
    line_stations: { conflictTarget: ['line_id', 'station_id'], sweepMarkerColumn: 'order' },
    segments: {
        conflictTarget: ['line_id', 'from_station_id', 'to_station_id'],
        omitColumns: ['id'],
        sweepMarkerColumn: 'position',
    },
}

export const REFERENCE_TABLE_NAMES = Object.keys(REFERENCE_TABLES)

// `order` and `position` are SQL keywords, and column names reach this from the live schema.
const quoteIdent = (name: string): string => `"${name.replace(/"/g, '""')}"`

/*
 * Dump the reference tables as upserts on their natural key, so a remote load converges on
 * the freshly built copy instead of only ever adding rows. Rows the reports table depends
 * on are still never deleted (see REFERENCE_TABLES).
 *
 * Sweeping is mark-then-delete rather than a NOT IN over every key, which would be a single
 * statement holding thousands of tuples: negate the marker column up front, let each upsert
 * write the real value back, then drop whatever is still negative. The marker columns are
 * row orderings, never negative in a built dataset.
 */
export const dumpReferenceTables = async (d1: D1Database): Promise<string> => {
    const statements: string[] = []

    for (const table of REFERENCE_TABLE_NAMES) {
        const spec = REFERENCE_TABLES[table]
        const { results } = await d1.prepare(`SELECT * FROM ${table}`).all<Record<string, unknown>>()
        const marker = spec.sweepMarkerColumn !== undefined ? quoteIdent(spec.sweepMarkerColumn) : null

        if (marker !== null) statements.push(`UPDATE ${table} SET ${marker} = -${marker} - 1;`)

        for (const row of results) {
            const columns = Object.keys(row).filter((column) => !(spec.omitColumns ?? []).includes(column))
            const values = columns.map((column) => toSqlLiteral(row[column]))
            const updated = columns.filter((column) => !spec.conflictTarget.includes(column))
            // A row that is nothing but its natural key has no column left to update.
            const resolution =
                updated.length > 0
                    ? `DO UPDATE SET ${updated.map((c) => `${quoteIdent(c)} = excluded.${quoteIdent(c)}`).join(', ')}`
                    : 'DO NOTHING'

            statements.push(
                `INSERT INTO ${table} (${columns.map(quoteIdent).join(', ')}) VALUES (${values.join(', ')}) ` +
                    `ON CONFLICT (${spec.conflictTarget.map(quoteIdent).join(', ')}) ${resolution};`
            )
        }

        if (marker !== null) statements.push(`DELETE FROM ${table} WHERE ${marker} < 0;`)
    }

    return `${statements.join('\n')}\n`
}
