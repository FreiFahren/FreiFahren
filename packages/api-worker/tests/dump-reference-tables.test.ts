import type { D1Database } from '@cloudflare/workers-types'
import { describe, expect, it } from 'vitest'

import { REFERENCE_TABLE_NAMES, dumpReferenceTables } from '../src/db/seed/dump-reference-tables'

// Minimal stand-in for the local D1 the seed dumps from: every SELECT * returns the
// rows registered for that table.
const fakeD1 = (tables: Record<string, Record<string, unknown>[]>): D1Database =>
    ({
        prepare: (query: string) => ({
            all: async () => ({ results: tables[query.replace('SELECT * FROM ', '')] ?? [] }),
        }),
    }) as unknown as D1Database

const segmentRow = {
    id: 7,
    line_id: 'M41',
    from_station_id: 'a',
    to_station_id: 'b',
    position: 0,
    color: '#95276E',
    coordinates: '[[1,2],[3,4]]',
}

const dumpOf = (tables: Record<string, Record<string, unknown>[]>) => dumpReferenceTables(fakeD1(tables))

describe('dumpReferenceTables', () => {
    it('never writes the segments surrogate id', async () => {
        const sql = await dumpOf({ segments: [segmentRow] })

        // The id is assigned by insertion order into a database CI rebuilds from scratch, so
        // carrying it over would name a different segment on every network change.
        expect(sql).not.toMatch(/INSERT INTO segments \([^)]*"id"/)
        expect(sql).toContain(
            'INSERT INTO segments ("line_id", "from_station_id", "to_station_id", "position", "color", "coordinates")'
        )
    })

    it('matches an existing remote segment on its natural key and refreshes the payload', async () => {
        const sql = await dumpOf({ segments: [segmentRow] })

        expect(sql).toContain('ON CONFLICT ("line_id", "from_station_id", "to_station_id") DO UPDATE SET')
        expect(sql).toContain('"coordinates" = excluded."coordinates"')
        // Key columns are what the row is matched on; rewriting them to themselves is noise.
        expect(sql).not.toContain('"line_id" = excluded."line_id"')
    })

    it('brackets a swept table with a marker update and a sweep delete', async () => {
        const statements = (await dumpOf({ segments: [segmentRow] }))
            .trim()
            .split('\n')
            .filter((statement) => statement.includes('segments'))

        // The marker has to be set before the upserts write real values back, and swept after.
        expect(statements[0]).toBe('UPDATE segments SET "position" = -"position" - 1;')
        expect(statements[statements.length - 1]).toBe('DELETE FROM segments WHERE "position" < 0;')
        expect(statements[1]).toContain('INSERT INTO segments')
    })

    it('quotes marker columns that are SQL keywords', async () => {
        const sql = await dumpOf({ line_stations: [{ line_id: 'M41', station_id: 'a', order: 0 }] })

        expect(sql).toContain('UPDATE line_stations SET "order" = -"order" - 1;')
        expect(sql).toContain('DELETE FROM line_stations WHERE "order" < 0;')
    })

    it('leaves tables that reports depend on unswept', async () => {
        const sql = await dumpOf({
            stations: [{ id: 'a', name: 'Kottbusser Tor', lat: 1, lng: 2 }],
            lines: [{ id: 'M41', name: 'M41', type: 'bus', is_circular: 0, color: '#95276E' }],
        })

        // reports references stations and lines with ON DELETE no action, so pruning them
        // would either fail the load or orphan user data.
        expect(sql).not.toContain('DELETE FROM stations')
        expect(sql).not.toContain('DELETE FROM lines')
        expect(sql).toContain('ON CONFLICT ("id") DO UPDATE SET "name" = excluded."name"')
    })

    it('emits parents before children so the load satisfies foreign keys', () => {
        expect(REFERENCE_TABLE_NAMES).toEqual(['stations', 'lines', 'line_stations', 'segments'])
    })

    it('escapes quotes in values', async () => {
        const sql = await dumpOf({ stations: [{ id: 'a', name: "O'Brien", lat: 1, lng: 2 }] })

        expect(sql).toContain("'O''Brien'")
    })
})
