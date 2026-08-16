import { env } from 'cloudflare:test'
import { sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'

import { dumpReferenceTables } from '../src/db/seed/dump-reference-tables'

import { db } from './test-db'

// The shared D1 is migrated and seeded with the real Berlin network in tests/setup.ts, so the
// dump under test is the one a deploy would actually load.
type SegmentRow = { id: number; line_id: string; from_station_id: string; to_station_id: string; position: number }

const segmentRows = async (): Promise<SegmentRow[]> =>
    (
        await db.run(
            sql`SELECT id, line_id, from_station_id, to_station_id, position FROM segments ORDER BY line_id, position`
        )
    ).results as SegmentRow[]

const keyOf = (row: SegmentRow) => `${row.line_id}|${row.from_station_id}|${row.to_station_id}`

const countOf = async (table: string): Promise<number> =>
    Number((await db.run(sql.raw(`SELECT COUNT(*) AS n FROM ${table}`))).results[0].n)

// `wrangler d1 execute --file` runs the statements in order; exec() is the closest equivalent.
const applyDump = async (dump: string): Promise<void> => {
    const statements = dump.trim().split('\n')
    for (let i = 0; i < statements.length; i += 500) {
        await env.DB.exec(statements.slice(i, i + 500).join('\n'))
    }
}

let dump: string
let expected: SegmentRow[]

beforeAll(async () => {
    dump = await dumpReferenceTables(env.DB)
    expected = await segmentRows()
})

// A station pair the build can never produce (a segment always joins two different stations), so
// this row is unambiguously obsolete.
const insertObsoleteSegment = () =>
    db.run(sql`INSERT INTO segments (line_id, from_station_id, to_station_id, position, color, coordinates)
               SELECT line_id, from_station_id, from_station_id, 99, '#000000', '[[1,2],[3,4]]'
               FROM segments LIMIT 1`)

// Simulate what a deployed database drifts into: some lines never landed, ids mean something
// else, and a row survives for a station pair no line has.
const driftDatabase = async () => {
    await db.run(sql`DELETE FROM segments WHERE line_id IN (SELECT id FROM lines WHERE type = 'bus')`)
    await db.run(sql`UPDATE segments SET id = id + 100000`)
    await insertObsoleteSegment()
}

describe('dumpReferenceTables', () => {
    it('converges a drifted database onto the built data', async () => {
        await driftDatabase()
        expect(await segmentRows()).not.toEqual(expected)

        await applyDump(dump)

        const after = await segmentRows()
        expect(after.map(keyOf)).toEqual(expected.map(keyOf))
        expect(after.map((row) => row.position)).toEqual(expected.map((row) => row.position))
    })

    it('removes rows that are no longer in the snapshot', async () => {
        await insertObsoleteSegment()

        await applyDump(dump)

        expect(await countOf('segments')).toBe(expected.length)
        expect(
            Number((await db.run(sql`SELECT COUNT(*) AS n FROM segments WHERE color = '#000000'`)).results[0].n)
        ).toBe(0)
    })

    // The marker must not be self-inverse: an interrupted load leaves rows already marked, and a
    // retry that flipped them back would let obsolete rows escape the sweep.
    it('converges when a partially applied load is retried', async () => {
        await driftDatabase()
        const marker = dump
            .trim()
            .split('\n')
            .find((statement) => statement.startsWith('UPDATE segments SET'))
        await env.DB.exec(marker!)

        await applyDump(dump)

        expect((await segmentRows()).map(keyOf)).toEqual(expected.map(keyOf))
        expect(await countOf('segments')).toBe(expected.length)
    })

    it('keeps the ids of rows that survive', async () => {
        const before = new Map((await segmentRows()).map((row) => [keyOf(row), row.id]))

        await applyDump(dump)

        const after = await segmentRows()
        expect(after.every((row) => before.get(keyOf(row)) === row.id)).toBe(true)
    })

    it('leaves user reports and the tables they reference intact', async () => {
        const stations = await countOf('stations')
        const lines = await countOf('lines')

        await applyDump(dump)

        expect(await countOf('stations')).toBe(stations)
        expect(await countOf('lines')).toBe(lines)
        expect(dump).not.toContain('DELETE FROM stations')
        expect(dump).not.toContain('DELETE FROM lines')
    })

    // Ids are content-derived, so reloading the same data must leave every one of them alone.
    // A client caches the segments GeoJSON and joins risk onto it by id; churning ids would paint
    // risk colours onto the wrong lines until that cache happens to refresh.
    it('assigns ids that survive a reload', async () => {
        const before = new Map((await segmentRows()).map((row) => [keyOf(row), row.id]))

        await driftDatabase()
        await applyDump(dump)

        const after = await segmentRows()
        expect(after.length).toBe(before.size)
        expect(after.every((row) => before.get(keyOf(row)) === row.id)).toBe(true)
    })
})
