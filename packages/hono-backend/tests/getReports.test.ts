import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { DateTime, Settings } from 'luxon'

import { db, lineStations, lines, reports, stations } from '../src/db'
import { seedBaseData } from '../src/db/seed/seed'
import app from '../src/index'

import { getDefaultReportsRange, MAX_REPORTS_TIMEFRAME } from '../src/modules/reports/constants'
import { sendReportRequest } from './test-utils'

let testStationId: string
let testLineId: string

// Note: this function is primarily used for timeframe filtering tests and prediction accuracy tests
// It is better to use the `sendReportRequest` function for testing business logic and API behavior.
// Since this function bypasses the API validation and post-processing pipeline, it is not a good fit for testing the API.
const createReportWithTimestamp = async (
    timestamp: Date,
    stationId: string = testStationId,
    lineId: string = testLineId
) => {
    await db.insert(reports).values({
        stationId,
        lineId,
        directionId: stationId,
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

        // Get stations that are actually on this line (need at least 3 for accuracy tests)
        const stationsOnLine = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, testLineId))
            .limit(10)

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
            await sendReportRequest({ stationId, lineId: testLineId, directionId: stationId, source: 'telegram' })
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
            await sendReportRequest({ stationId, lineId: testLineId, directionId: stationId, source: 'telegram' })
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

        await sendReportRequest({ stationId: realStationId, lineId: testLineId, directionId: realStationId, source: 'telegram' })

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

    it('predicts the most frequently reported station for a given time pattern', async () => {
        // Create a clear pattern: Station A reported 5 times on Mondays at 3pm
        // Station B reported 2 times on Mondays at 3pm
        const stationA = allStationIds[0]
        const stationB = allStationIds[1]

        // Get a Monday at 3pm (15:00) in the past for historical data
        const historicalMonday = DateTime.now()
            .toUTC()
            .minus({ weeks: 1 })
            .set({ weekday: 1, hour: 15, minute: 0, second: 0, millisecond: 0 })

        // Create 5 reports for station A
        for (let i = 0; i < 5; i++) {
            await createReportWithTimestamp(historicalMonday.minus({ minutes: i }).toJSDate(), stationA, testLineId)
        }

        // Create 2 reports for station B
        for (let i = 0; i < 2; i++) {
            await createReportWithTimestamp(
                historicalMonday.minus({ minutes: i + 10 }).toJSDate(),
                stationB,
                testLineId
            )
        }

        // Now query for current Monday at 3pm (should trigger predictions based on historical data)
        const currentMonday = DateTime.now().toUTC().set({ weekday: 1, hour: 15, minute: 0, second: 0, millisecond: 0 })

        const from = currentMonday.minus({ minutes: 30 })
        const to = currentMonday.plus({ minutes: 30 })

        const response = await app.request(
            `/v0/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
        )

        expect(response.status).toBe(200)

        const body = (await response.json()) as Array<{
            stationId: string
            isPredicted: boolean
        }>

        const predictedReports = body.filter((r) => r.isPredicted)

        // Station A should appear in predictions because it was the most common
        const predictedStationIds = new Set(predictedReports.map((r) => r.stationId))
        expect(predictedStationIds.has(stationA)).toBe(true)

        // Station B might or might not appear depending on the threshold,
        // but Station A should definitely appear since it's the most common
    })

    it('uses expanding time windows when no exact match is found', async () => {
        const stationA = allStationIds[0]

        // Create reports on Tuesday at 10am (2 days and 5 hours away from target)
        const historicalTuesday = DateTime.now()
            .toUTC()
            .minus({ weeks: 1 })
            .set({ weekday: 2, hour: 10, minute: 0, second: 0, millisecond: 0 })

        for (let i = 0; i < 3; i++) {
            await createReportWithTimestamp(historicalTuesday.minus({ minutes: i }).toJSDate(), stationA, testLineId)
        }

        // Query for Thursday at 3pm (requires expanding window to find Tuesday 10am reports)
        const currentThursday = DateTime.now()
            .toUTC()
            .set({ weekday: 4, hour: 15, minute: 0, second: 0, millisecond: 0 })

        const from = currentThursday.minus({ minutes: 30 })
        const to = currentThursday.plus({ minutes: 30 })

        const response = await app.request(
            `/v0/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
        )

        expect(response.status).toBe(200)

        const body = (await response.json()) as Array<{
            stationId: string
            isPredicted: boolean
        }>

        // Should have some predicted reports (using expanded window to find historical data)
        const predictedReports = body.filter((r) => r.isPredicted)
        expect(predictedReports.length).toBeGreaterThan(0)
    })
})

describe('Predicted reports threshold', () => {
    let testStations: string[]

    // Helper to create historical data for predictions
    const seedHistoricalData = async () => {
        // Create historical data across multiple days, times, and stations
        for (let weeksAgo = 1; weeksAgo <= 2; weeksAgo++) {
            for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
                for (const hour of [7, 9, 12, 15, 18, 21]) {
                    for (let stationIdx = 0; stationIdx < Math.min(testStations.length, 7); stationIdx++) {
                        const historicalTime = DateTime.utc(2024, 1, 1, hour, 0).minus({
                            weeks: weeksAgo,
                            days: dayOffset,
                            minutes: stationIdx * 2,
                        })
                        await createReportWithTimestamp(historicalTime.toJSDate(), testStations[stationIdx], testLineId)
                    }
                }
            }
        }
    }

    beforeAll(async () => {
        await seedBaseData(db)

        const [line] = await db.select({ id: lines.id }).from(lines).limit(1)
        testLineId = line.id

        const stationsOnLine = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, testLineId))
            .limit(10)

        testStations = stationsOnLine.map((s) => s.stationId)
    })

    beforeEach(async () => {
        await db.delete(reports)
        // Seed historical data before each test
        await seedHistoricalData()
    })

    afterEach(async () => {
        await db.delete(reports)
        // Reset time mocking after each test
        Settings.now = () => Date.now()
    })

    it('returns more predicted reports during peak hours than night hours', async () => {
        // Test peak hours - Monday at 15:00 (threshold should be 7)
        const mondayAfternoon = DateTime.utc(2024, 1, 15, 15, 0)
        Settings.now = () => mondayAfternoon.toMillis()

        const fromPeak = mondayAfternoon.minus({ hours: 1 })
        const toPeak = mondayAfternoon.plus({ hours: 1 })

        const responsePeak = await app.request(
            `/v0/reports?from=${encodeURIComponent(fromPeak.toISO()!)}&to=${encodeURIComponent(toPeak.toISO()!)}`
        )

        expect(responsePeak.status).toBe(200)
        const peakBody = (await responsePeak.json()) as Array<{ isPredicted: boolean }>
        const peakTotal = peakBody.length

        // Test night hours - Tuesday at 2:00 AM (threshold should be 1)
        const tuesdayNight = DateTime.utc(2024, 1, 16, 2, 0)
        Settings.now = () => tuesdayNight.toMillis()

        const fromNight = tuesdayNight.minus({ hours: 1 })
        const toNight = tuesdayNight.plus({ hours: 1 })

        const responseNight = await app.request(
            `/v0/reports?from=${encodeURIComponent(fromNight.toISO()!)}&to=${encodeURIComponent(toNight.toISO()!)}`
        )

        expect(responseNight.status).toBe(200)
        const nightBody = (await responseNight.json()) as Array<{ isPredicted: boolean }>
        const nightTotal = nightBody.length

        // Peak hours should have more reports than night hours
        expect(peakTotal).toBeGreaterThan(nightTotal)
        expect(nightTotal).toBeGreaterThanOrEqual(1) // At least meets minimum threshold
        expect(peakTotal).toBeGreaterThanOrEqual(2) // Should have more than night
    })

    it('respects threshold limits across different times of day', async () => {
        // Test multiple times to verify threshold is respected
        const times = [
            { time: DateTime.utc(2024, 1, 15, 2, 0), minExpected: 1, maxExpected: 2 }, // 2am night
            { time: DateTime.utc(2024, 1, 15, 12, 0), minExpected: 2, maxExpected: 7 }, // noon peak
        ]

        for (const { time, minExpected, maxExpected } of times) {
            Settings.now = () => time.toMillis()

            const from = time.minus({ hours: 1 })
            const to = time.plus({ hours: 1 })

            const response = await app.request(
                `/v0/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
            )

            expect(response.status).toBe(200)
            const body = (await response.json()) as Array<{ isPredicted: boolean }>
            const total = body.length

            // Verify threshold is respected
            expect(total).toBeGreaterThanOrEqual(minExpected)
            expect(total).toBeLessThanOrEqual(maxExpected)
        }
    })

    it('increases threshold from early morning to peak hours', async () => {
        // Test at 7:00 AM (start of increase period)
        const morning7 = DateTime.utc(2024, 1, 15, 7, 0) // Monday
        Settings.now = () => morning7.toMillis()

        const from7 = morning7.minus({ hours: 1 })
        const to7 = morning7.plus({ hours: 1 })

        const response7 = await app.request(
            `/v0/reports?from=${encodeURIComponent(from7.toISO()!)}&to=${encodeURIComponent(to7.toISO()!)}`
        )

        const body7 = (await response7.json()) as Array<{ isPredicted: boolean }>
        const total7 = body7.length

        // Test at 12:00 PM (peak hours)
        const noon = DateTime.utc(2024, 1, 15, 12, 0) // Monday
        Settings.now = () => noon.toMillis()

        const fromNoon = noon.minus({ hours: 1 })
        const toNoon = noon.plus({ hours: 1 })

        const responseNoon = await app.request(
            `/v0/reports?from=${encodeURIComponent(fromNoon.toISO()!)}&to=${encodeURIComponent(toNoon.toISO()!)}`
        )

        const bodyNoon = (await responseNoon.json()) as Array<{ isPredicted: boolean }>
        const totalNoon = bodyNoon.length

        // Threshold should increase from morning to afternoon
        expect(total7).toBeGreaterThanOrEqual(1) // Morning has low threshold
        expect(totalNoon).toBeGreaterThan(total7) // Noon should have higher threshold
    })

    it('maintains a linear threshold ramp until the end of each window without premature clamping', async () => {
        // At 20:30 on a weekday (near the end of the 18:00–21:00 ramp), the threshold
        // should still be above the minimum of 1. With incorrect slope (e.g. 9/180 instead
        // of 6/180), the base would already be negative here and clamped to 1.
        const weekdayLateEvening = DateTime.utc(2024, 1, 15, 20, 30) // Monday 20:30
        Settings.now = () => weekdayLateEvening.toMillis()

        const fromLate = weekdayLateEvening.minus({ hours: 1 })
        const toLate = weekdayLateEvening.plus({ hours: 1 })

        const responseLate = await app.request(
            `/v0/reports?from=${encodeURIComponent(fromLate.toISO()!)}&to=${encodeURIComponent(toLate.toISO()!)}`
        )

        expect(responseLate.status).toBe(200)
        const lateBody = (await responseLate.json()) as Array<{ isPredicted: boolean }>
        const latePredicted = lateBody.filter((r) => r.isPredicted).length

        // At 23:00 (flat minimum period, threshold = 1)
        const weekdayNight = DateTime.utc(2024, 1, 15, 23, 0) // Monday 23:00
        Settings.now = () => weekdayNight.toMillis()

        const fromNight = weekdayNight.minus({ hours: 1 })
        const toNight = weekdayNight.plus({ hours: 1 })

        const responseNight = await app.request(
            `/v0/reports?from=${encodeURIComponent(fromNight.toISO()!)}&to=${encodeURIComponent(toNight.toISO()!)}`
        )

        expect(responseNight.status).toBe(200)
        const nightBody = (await responseNight.json()) as Array<{ isPredicted: boolean }>
        const nightPredicted = nightBody.filter((r) => r.isPredicted).length

        // 20:30 is still in the linear ramp so its threshold should be above 1,
        // meaning more predicted reports than during the flat minimum at 23:00
        expect(latePredicted).toBeGreaterThan(nightPredicted)
    })

    it('prioritizes placing predicted report timestamps early in the time range to appear old', async () => {
        // Mock time to Monday at 12:00
        const mondayNoon = DateTime.utc(2024, 1, 15, 12, 0)
        Settings.now = () => mondayNoon.toMillis()

        // Query for a 2-hour window
        const from = mondayNoon.minus({ hours: 1 })
        const to = mondayNoon.plus({ hours: 1 })

        const response = await app.request(
            `/v0/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
        )

        expect(response.status).toBe(200)

        const body = (await response.json()) as Array<{
            timestamp: string
            isPredicted: boolean
        }>

        const predictedReports = body.filter((r) => r.isPredicted)

        // Should have some predicted reports
        expect(predictedReports.length).toBeGreaterThan(0)

        // Calculate time boundaries
        const rangeMillis = to.toMillis() - from.toMillis()
        const firstQuarterEnd = from.plus({ milliseconds: rangeMillis / 4 })
        const midpoint = from.plus({ milliseconds: rangeMillis / 2 })

        // Count timestamps in each section
        const inFirstQuarter = predictedReports.filter((r) => {
            const reportTime = DateTime.fromISO(r.timestamp)
            return reportTime >= from && reportTime <= firstQuarterEnd
        }).length

        const beforeMidpoint = predictedReports.filter((r) => {
            const reportTime = DateTime.fromISO(r.timestamp)
            return reportTime >= from && reportTime <= midpoint
        }).length

        // The algorithm tries first quarter first, so more timestamps should be in the earlier half
        // At least some should be in the first quarter (algorithm tries this first)
        expect(inFirstQuarter).toBeGreaterThan(0)

        // Most should be before midpoint (first quarter and first half attempts)
        expect(beforeMidpoint).toBeGreaterThanOrEqual(Math.floor(predictedReports.length / 2))

        // All timestamps should be within the valid range
        for (const report of predictedReports) {
            const reportTime = DateTime.fromISO(report.timestamp)
            expect(reportTime >= from).toBe(true)
            expect(reportTime <= to).toBe(true)
        }
    })
})
