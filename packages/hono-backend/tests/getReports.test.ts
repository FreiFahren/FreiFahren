import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { DateTime } from 'luxon'

import { db, lines, reports, stations } from '../src/db'
import { seedBaseData } from '../src/db/seed/seed'
import app from '../src/index'

import { getDefaultReportsRange, MAX_REPORTS_TIMEFRAME } from '../src/modules/reports/constants'

let testStationId: string
let testLineId: string

const createReport = async (timestamp: Date) => {
    await db.insert(reports).values({
        stationId: testStationId,
        lineId: testLineId,
        directionId: testLineId,
        timestamp,
        source: 'telegram',
    })
}

describe('Timeframe filtering', () => {
    beforeAll(async () => {
        await seedBaseData(db)

        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)
        const [line] = await db.select({ id: lines.id }).from(lines).limit(1)

        testStationId = station.id
        testLineId = line.id
    })

    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(async () => {
        await db.delete(reports)
    })

    it('returns data in the specified timeframe when from and to query params are present', async () => {
        const now = DateTime.now().toUTC()
        const insideOne = now.minus({ minutes: 30 })
        const insideTwo = now.minus({ minutes: 10 })
        const outside = now.minus({ hours: 2 })

        await createReport(outside.toJSDate())
        await createReport(insideOne.toJSDate())
        await createReport(insideTwo.toJSDate())

        const from = now.minus({ minutes: 45 }).toISO()
        const to = now.minus({ minutes: 5 }).toISO()

        const response = await app.request(
            `/v0/reports?from=${encodeURIComponent(from!)}&to=${encodeURIComponent(to!)}`
        )

        expect(response.status).toBe(200)

        const body = (await response.json()) as Array<{
            timestamp: string
        }>

        const timestamps = body.map((item) => DateTime.fromISO(item.timestamp))

        expect(timestamps.length).toBe(2)
        expect(
            timestamps.every((timestamp) => timestamp >= DateTime.fromISO(from!) && timestamp <= DateTime.fromISO(to!))
        ).toBe(true)
    })

    it('returns data in the standard timeframe when query params are missing', async () => {
        const now = DateTime.now().toUTC()
        const { from, to } = getDefaultReportsRange(now)

        const older = from.minus({ minutes: 10 })
        const inside = from.plus({ minutes: 10 })

        await createReport(older.toJSDate())
        await createReport(inside.toJSDate())

        const response = await app.request('/v0/reports')

        expect(response.status).toBe(200)

        const body = (await response.json()) as Array<{
            timestamp: string
        }>

        const timestamps = body.map((item) => DateTime.fromISO(item.timestamp))

        expect(timestamps.length).toBe(1)
        expect(timestamps[0] >= from && timestamps[0] <= to).toBe(true)
    })

    it('returns 400 when from is after to', async () => {
        const now = DateTime.now().toUTC()
        const from = now
        const to = now.minus({ hours: 1 })

        const response = await app.request(
            `/v0/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
        )

        expect(response.status).toBe(400)
    })

    it('returns 400 when timeframe is longer than the maximum', async () => {
        const now = DateTime.now().toUTC()
        const from = now.minus({ days: MAX_REPORTS_TIMEFRAME + 1 }).toISO()
        const to = now.toISO()

        const response = await app.request(
            `/v0/reports?from=${encodeURIComponent(from!)}&to=${encodeURIComponent(to!)}`
        )

        expect(response.status).toBe(400)
    })
})
