import { applyD1Migrations, env } from 'cloudflare:test'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { dumpReferenceTables } from '../src/db/seed/dump-reference-tables'
import { segmentId } from '../src/db/seed/segments'

// Runs against a scratch database, not the shared seed: this suite rewrites whole tables and
// isolatedStorage is off. A small hand-built network keeps the generated SQL small enough to push
// through the runtime while still exercising the real dump against real D1.
const d1 = () => env.DB_RECONCILE

const STATIONS = ['s1', 's2', 's3', 's4']
const LINE = 'U1'

const segmentValues = (from: string, to: string, position: number) =>
    `(${segmentId(LINE, from, to)}, '${LINE}', '${from}', '${to}', ${position}, '#111111', '[[1,2],[3,4]]')`

const buildNetwork = () =>
    d1().exec(
        [
            'DELETE FROM segments;',
            'DELETE FROM line_stations;',
            'DELETE FROM reports;',
            'DELETE FROM stations;',
            'DELETE FROM lines;',
            `INSERT INTO stations (id, name, lat, lng) VALUES ${STATIONS.map((id, i) => `('${id}', 'Station ${i}', ${52 + i / 100}, ${13 + i / 100})`).join(', ')};`,
            `INSERT INTO lines (id, name, type, is_circular, color) VALUES ('${LINE}', 'U1', 'subway', 0, '#111111');`,
            `INSERT INTO line_stations (line_id, station_id, "order") VALUES ${STATIONS.map((id, i) => `('${LINE}', '${id}', ${i})`).join(', ')};`,
            `INSERT INTO segments (id, line_id, from_station_id, to_station_id, position, color, coordinates) VALUES ${[
                segmentValues('s1', 's2', 0),
                segmentValues('s2', 's3', 1),
                segmentValues('s3', 's4', 2),
            ].join(', ')};`,
        ].join('\n')
    )

type Row = Record<string, unknown>

const rowsOf = async (table: string): Promise<Row[]> =>
    (await d1().prepare(`SELECT * FROM ${table} ORDER BY rowid`).all<Row>()).results

const applyDump = (dump: string) => d1().exec(dump.trim())

// A pair the build never produces, so it is unambiguously obsolete.
const insertObsoleteSegment = () =>
    d1().exec(
        `INSERT INTO segments (line_id, from_station_id, to_station_id, position, color, coordinates) VALUES ('${LINE}', 's4', 's1', 9, '#000000', '[[9,9],[8,8]]');`
    )

let dump: string
let expectedSegments: Row[]

beforeAll(async () => {
    await applyD1Migrations(d1(), env.TEST_MIGRATIONS)
})

beforeEach(async () => {
    await buildNetwork()
    dump = await dumpReferenceTables(d1())
    expectedSegments = await rowsOf('segments')
})

describe('dumpReferenceTables', () => {
    it('restores rows that are missing from the target', async () => {
        await d1().exec(`DELETE FROM segments WHERE from_station_id = 's2';`)

        await applyDump(dump)

        expect(await rowsOf('segments')).toEqual(expectedSegments)
    })

    it('refreshes rows whose content drifted', async () => {
        await d1().exec(`UPDATE segments SET color = '#ffffff';`)
        await d1().exec(`UPDATE stations SET name = 'stale';`)

        await applyDump(dump)

        expect(await rowsOf('segments')).toEqual(expectedSegments)
        expect((await rowsOf('stations')).every((row) => row.name !== 'stale')).toBe(true)
    })

    it('removes rows that are no longer in the snapshot', async () => {
        await insertObsoleteSegment()

        await applyDump(dump)

        expect(await rowsOf('segments')).toEqual(expectedSegments)
    })

    // The marker must not be self-inverse: an interrupted load leaves rows already marked, and a
    // retry that flipped them back would let obsolete rows escape the sweep.
    it('converges when a partially applied load is retried', async () => {
        await insertObsoleteSegment()
        const marker = dump
            .trim()
            .split('\n')
            .find((statement) => statement.startsWith('UPDATE segments SET'))
        await d1().exec(marker!)

        await applyDump(dump)

        expect(await rowsOf('segments')).toEqual(expectedSegments)
    })

    it('applies cleanly twice', async () => {
        await applyDump(dump)
        await applyDump(dump)

        expect(await rowsOf('segments')).toEqual(expectedSegments)
    })

    // reports references stations and lines with ON DELETE no action, so pruning either would fail
    // the load or orphan user data.
    it('never deletes from the tables reports depend on', async () => {
        await d1().exec(
            `INSERT INTO stations (id, name, lat, lng) VALUES ('retired', 'Retired', 52.0, 13.0);
INSERT INTO reports (station_id, source) VALUES ('retired', 'telegram');`
        )

        await applyDump(dump)

        expect((await rowsOf('stations')).some((row) => row.id === 'retired')).toBe(true)
        expect(await rowsOf('reports')).toHaveLength(1)
        expect(dump).not.toContain('DELETE FROM stations')
        expect(dump).not.toContain('DELETE FROM lines')
    })

    it('keeps segment ids stable across a reload', async () => {
        const before = await rowsOf('segments')

        await d1().exec(`UPDATE segments SET id = id + 100000;`)
        await applyDump(dump)

        expect(await rowsOf('segments')).toEqual(before)
    })
})
