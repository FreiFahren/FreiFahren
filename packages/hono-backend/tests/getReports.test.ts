import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { DateTime } from 'luxon'

import { db, lineStations, lines, reports, stations } from '../src/db'
import { seedBaseData } from '../src/db/seed/seed'
import app from '../src/index'

import { getDefaultReportsRange, MAX_REPORTS_TIMEFRAME } from '../src/modules/reports/constants'

let testStationId: string
let testLineId: string

// Note: this function is primarily used for timeframe filtering tests
// It is better to use the `createReportViaAPI` function for testing business logic and API behavior.
// Since this function bypasses the API validation and post-processing pipeline, it is not a good fit for testing the API.
const createReportWithTimestamp = async (timestamp: Date) => {
    await db.insert(reports).values({
        stationId: testStationId,
        lineId: testLineId,
        directionId: testStationId,
        timestamp,
        source: 'telegram',
    })
}

const createReportViaAPI = async (stationId: string, lineId: string) => {
    await app.request('/v0/reports', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            stationId,
            lineId,
            directionId: stationId,
            source: 'telegram',
        }),
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

        await createReportWithTimestamp(outside.toJSDate())
        await createReportWithTimestamp(insideOne.toJSDate())
        await createReportWithTimestamp(insideTwo.toJSDate())

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

        await createReportWithTimestamp(older.toJSDate())
        await createReportWithTimestamp(inside.toJSDate())

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

describe('Predicted reports', () => {
    let allStationIds: string[]

    beforeAll(async () => {
        await seedBaseData(db)

        const [line] = await db.select({ id: lines.id }).from(lines).limit(1)
        testLineId = line.id

        // Get stations that are actually on this line
        const stationsOnLine = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, testLineId))

        allStationIds = stationsOnLine.map((s) => s.stationId)
    })

    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(async () => {
        await db.delete(reports)
    })

    it('ensures predicted reports have unique station IDs and do not overlap with real reports', async () => {
        const from = DateTime.now().toUTC().minus({ hours: 1 })

        // Create 2 real reports for specific stations (this will trigger predicted reports since threshold is higher)
        const realStationIds = [allStationIds[0], allStationIds[1]]

        for (const stationId of realStationIds) {
            await createReportViaAPI(stationId, testLineId)
        }

        // Set 'to' after creating reports to ensure they're captured
        const to = DateTime.now().toUTC().plus({ seconds: 5 })

        const response = await app.request(
            `/v0/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
        )

        expect(response.status).toBe(200)

        const body = (await response.json()) as Array<{
            stationId: string
            isPredicted: boolean
        }>

        const predictedReports = body.filter((r) => r.isPredicted)
        const nonPredictedReports = body.filter((r) => !r.isPredicted)

        // Test 1: Predicted reports exclude station IDs of non-predicted reports
        const nonPredictedStationIds = new Set(nonPredictedReports.map((r) => r.stationId))
        const predictedStationIds = predictedReports.map((r) => r.stationId)

        for (const predictedStationId of predictedStationIds) {
            expect(nonPredictedStationIds.has(predictedStationId)).toBe(false)
        }

        // Test 2: Predicted reports have unique station IDs (no duplicates)
        const uniquePredictedStationIds = new Set(predictedStationIds)
        expect(uniquePredictedStationIds.size).toBe(predictedStationIds.length)
    })

    it('allows non-predicted reports to have duplicate station IDs', async () => {
        const from = DateTime.now().toUTC().minus({ hours: 1 })

        // Create multiple reports for the same station at different times
        const stationId = allStationIds[0]

        for (let i = 0; i < 3; i++) {
            await createReportViaAPI(stationId, testLineId)
        }

        // Set 'to' after creating reports to ensure they're captured
        const to = DateTime.now().toUTC().plus({ seconds: 5 })

        const response = await app.request(
            `/v0/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
        )

        expect(response.status).toBe(200)

        const body = (await response.json()) as Array<{
            stationId: string
            isPredicted: boolean
        }>

        const nonPredictedReports = body.filter((r) => !r.isPredicted)

        // Test 3: Non-predicted reports can have duplicate station IDs
        const nonPredictedStationIds = nonPredictedReports.map((r) => r.stationId)
        const uniqueNonPredictedStationIds = new Set(nonPredictedStationIds)

        // Should have duplicates (more reports than unique station IDs)
        expect(nonPredictedStationIds.length).toBeGreaterThan(uniqueNonPredictedStationIds.size)
        expect(nonPredictedStationIds.filter((id) => id === stationId).length).toBe(3)
    })

    it('prevents same station from appearing as both predicted and non-predicted', async () => {
        const from = DateTime.now().toUTC().minus({ hours: 1 })

        // Create a real report for one station
        const realStationId = allStationIds[0]

        await createReportViaAPI(realStationId, testLineId)

        // Set 'to' after creating reports to ensure they're captured
        const to = DateTime.now().toUTC().plus({ seconds: 5 })

        const response = await app.request(
            `/v0/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
        )

        expect(response.status).toBe(200)

        const body = (await response.json()) as Array<{
            stationId: string
            isPredicted: boolean
        }>

        // Group reports by station ID
        const stationReports = body.reduce(
            (acc, report) => {
                if (!acc[report.stationId]) {
                    acc[report.stationId] = []
                }
                acc[report.stationId].push(report)
                return acc
            },
            {} as Record<string, Array<{ stationId: string; isPredicted: boolean }>>
        )

        // For each station, all reports must be either all predicted or all non-predicted
        // (no mixing of predicted and non-predicted for the same station)
        Object.entries(stationReports).forEach(([, reportsForStation]) => {
            const isPredictedValues = reportsForStation.map((r) => r.isPredicted)
            const allSame = isPredictedValues.every((val) => val === isPredictedValues[0])

            expect(allSame).toBe(true)
        })
    })
})
