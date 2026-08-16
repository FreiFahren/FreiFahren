import type { D1Database } from '@cloudflare/workers-types'

import { toSqlLiteral } from '../sql-literal'

interface ReferenceTableSpec {
    /** Natural key an existing remote row is matched on. */
    conflictTarget: readonly string[]
    /** Integer column set negative before the load, so rows no subsequent upsert touched can be swept. */
    sweepMarkerColumn?: string
}

/*
 * How each reference table is reconciled with the freshly built local copy.
 * Parents before children for FK order.
 *
 * Matching on the natural key rather than appending is what makes the load converge: the previous
 * `INSERT OR IGNORE ... VALUES (id, ...)` discarded any row whose id was already taken remotely,
 * which left prod serving 21 MetroBus lines with no geometry.
 *
 * `sweepMarkerColumn` marks a table prunable. Only the derived tables are swept — `reports`
 * references `stations` and `lines` with ON DELETE no action, so pruning those would fail the load
 * or orphan user data.
 */
export const REFERENCE_TABLES: Record<string, ReferenceTableSpec> = {
    stations: { conflictTarget: ['id'] },
    lines: { conflictTarget: ['id'] },
    line_stations: { conflictTarget: ['line_id', 'station_id'], sweepMarkerColumn: 'order' },
    segments: {
        conflictTarget: ['line_id', 'from_station_id', 'to_station_id'],
        sweepMarkerColumn: 'position',
    },
}

export const REFERENCE_TABLE_NAMES = Object.keys(REFERENCE_TABLES)

// `order` and `position` are SQL keywords, and column names reach this from the live schema.
const quoteIdent = (name: string): string => `"${name.replace(/"/g, '""')}"`

/*
 * Dump the reference tables as upserts on their natural key, so a remote load converges on the
 * freshly built copy instead of only ever adding rows.
 *
 * Sweeping is mark-then-delete rather than a NOT IN over thousands of tuples: set the marker
 * column negative, let each upsert write the real value back, then drop whatever is still
 * negative. The marker is a constant so an interrupted load can simply be retried.
 */
export const dumpReferenceTables = async (d1: D1Database): Promise<string> => {
    const statements: string[] = []

    for (const table of REFERENCE_TABLE_NAMES) {
        const spec = REFERENCE_TABLES[table]
        const { results } = await d1.prepare(`SELECT * FROM ${table}`).all<Record<string, unknown>>()
        const marker = spec.sweepMarkerColumn !== undefined ? quoteIdent(spec.sweepMarkerColumn) : null

        if (marker !== null) statements.push(`UPDATE ${table} SET ${marker} = -1;`)

        for (const row of results) {
            const columns = Object.keys(row)
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
