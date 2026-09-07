import { eq } from 'drizzle-orm'
import { DateTime, Settings } from 'luxon'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createApp } from '../src/index'
import {
    DEFAULT_REPORTS_TIMEFRAME,
    getDefaultReportsRange,
    MAX_REPORTS_TIMEFRAME,
} from '../src/modules/reports/constants'
import { calculatePredictedReportsThreshold, ReportsService } from '../src/modules/reports/reports-service'
import { db, lineStations, lines, reports } from './test-db'
import { appRequestWithRedirect, sendReportRequest, setSystemTime } from './test-utils'

let testStationId: string
let testLineId: string

const sendReportAt = async (timestamp: Date, stationId: string = testStationId, lineId: string = testLineId) => {
    setSystemTime(timestamp)
    expect((await sendReportRequest({ stationId, lineId, source: 'web_app' })).status).toBe(200)
}

const toIsoSeconds = (value: DateTime) => value.toUTC().toISO({ suppressMilliseconds: true })!

const getRealReports = async (response: Response) => {
    const body = (await response.json()) as Array<{
        timestamp: string
        stationId: string
        isPredicted: boolean
        expiresAt: string | null
    }>

    return body.filter((report) => !report.isPredicted)
}

const getValidReportPayload = async () => {
    const [stationOnLine] = await db
        .select({ stationId: lineStations.stationId })
        .from(lineStations)
        .where(eq(lineStations.lineId, testLineId))
        .limit(1)

    return {
        stationId: stationOnLine.stationId,
        lineId: testLineId,
        directionId: stationOnLine.stationId,
        source: 'web_app' as const,
    }
}

describe('Timeframe filtering', () => {
    beforeAll(async () => {
        const [line] = await db.select({ id: lines.id }).from(lines).limit(1)
        testLineId = line.id

        const [stationOnLine] = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, testLineId))
            .limit(1)
        testStationId = stationOnLine.stationId
    })

    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(async () => {
        await db.delete(reports)
        Settings.now = () => Date.now()
        setSystemTime()
    })

    it('returns data in the specified timeframe when from and to query params are present', async () => {
        const now = DateTime.now().toUTC()

        await sendReportAt(now.minus({ hours: 2 }).toJSDate())
        await sendReportAt(now.minus({ minutes: 30 }).toJSDate())
        await sendReportAt(now.minus({ minutes: 10 }).toJSDate())

        setSystemTime(now.toJSDate())
        const from = now.minus({ minutes: 45 }).toISO()
        const to = now.minus({ minutes: 5 }).toISO()

        const response = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(from!)}&to=${encodeURIComponent(to!)}`
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

        await sendReportAt(from.minus({ minutes: 10 }).toJSDate())
        await sendReportAt(from.plus({ minutes: 10 }).toJSDate())

        setSystemTime(now.toJSDate())
        const response = await appRequestWithRedirect('/reports')

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

        const response = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
        )

        expect(response.status).toBe(400)
    })

    it('returns 400 when timeframe is longer than the maximum', async () => {
        const now = DateTime.now().toUTC()
        const from = now.minus({ days: MAX_REPORTS_TIMEFRAME + 1 }).toISO()
        const to = now.toISO()

        const response = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(from!)}&to=${encodeURIComponent(to!)}`
        )

        expect(response.status).toBe(400)
    })
})

describe('Predicted reports', () => {
    let allStationIds: string[]

    beforeAll(async () => {
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
        Settings.now = () => Date.now()
        setSystemTime()
    })

    it('ensures predicted reports have unique station IDs and do not overlap with real reports', async () => {
        const from = DateTime.now().toUTC().minus({ hours: 1 })

        // Create 2 real reports for specific stations (this will trigger predicted reports since threshold is higher)
        const realStationIds = [allStationIds[0], allStationIds[1]]

        for (const stationId of realStationIds) {
            await sendReportRequest({ stationId, lineId: testLineId, directionId: stationId, source: 'web_app' })
        }

        // Set 'to' after creating reports to ensure they're captured
        const to = DateTime.now().toUTC().plus({ seconds: 5 })

        const response = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
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
            await sendReportRequest({ stationId, lineId: testLineId, directionId: stationId, source: 'web_app' })
        }

        // Set 'to' after creating reports to ensure they're captured
        const to = DateTime.now().toUTC().plus({ seconds: 5 })

        const response = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
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

        await sendReportRequest({
            stationId: realStationId,
            lineId: testLineId,
            directionId: realStationId,
            source: 'web_app',
        })

        // Set 'to' after creating reports to ensure they're captured
        const to = DateTime.now().toUTC().plus({ seconds: 5 })

        const response = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
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
        const now = DateTime.now().toUTC()
        const stationA = allStationIds[0]
        const stationB = allStationIds[1]

        // Get a Monday at 3pm (15:00) in the past for historical data
        const historicalMonday = now
            .minus({ weeks: 1 })
            .set({ weekday: 1, hour: 15, minute: 0, second: 0, millisecond: 0 })

        // Create 5 reports for station A
        for (let i = 0; i < 5; i++) {
            await sendReportAt(historicalMonday.minus({ minutes: i }).toJSDate(), stationA, testLineId)
        }

        // Create 2 reports for station B
        for (let i = 0; i < 2; i++) {
            await sendReportAt(historicalMonday.minus({ minutes: i + 10 }).toJSDate(), stationB, testLineId)
        }

        Settings.now = () => Date.now()

        // Now query for current Monday at 3pm (should trigger predictions based on historical data)
        setSystemTime(now.toJSDate())
        const currentMonday = now.set({ weekday: 1, hour: 15, minute: 0, second: 0, millisecond: 0 })

        const from = currentMonday.minus({ minutes: 30 })
        const to = currentMonday.plus({ minutes: 30 })

        const response = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
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
        const now = DateTime.now().toUTC()
        const stationA = allStationIds[0]

        // Create reports on Tuesday at 10am (2 days and 5 hours away from target)
        const historicalTuesday = now
            .minus({ weeks: 1 })
            .set({ weekday: 2, hour: 10, minute: 0, second: 0, millisecond: 0 })

        for (let i = 0; i < 3; i++) {
            await sendReportAt(historicalTuesday.minus({ minutes: i }).toJSDate(), stationA, testLineId)
        }

        Settings.now = () => Date.now()

        // Query for Thursday at 3pm (requires expanding window to find Tuesday 10am reports)
        setSystemTime(now.toJSDate())
        const currentThursday = now.set({ weekday: 4, hour: 15, minute: 0, second: 0, millisecond: 0 })

        const from = currentThursday.minus({ minutes: 30 })
        const to = currentThursday.plus({ minutes: 30 })

        const response = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
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
    const originalZone = Settings.defaultZone
    let testStations: string[]

    const seedHistoricalData = async () => {
        const historicalMonday = DateTime.utc(2024, 1, 8)
        for (let hour = 0; hour < 24; hour++) {
            await sendReportAt(
                historicalMonday.set({ hour }).toJSDate(),
                testStations[hour % Math.min(testStations.length, 5)],
                testLineId
            )
        }
    }

    beforeAll(async () => {
        const [line] = await db.select({ id: lines.id }).from(lines).limit(1)
        testLineId = line.id

        const stationsOnLine = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, testLineId))
            .limit(10)

        testStations = stationsOnLine.map((s) => s.stationId)
        await seedHistoricalData()
    })

    beforeEach(() => {
        Settings.now = () => Date.now()
        setSystemTime()

        const samples = [0, 0.49, 0.99]
        let sampleIndex = 0
        vi.spyOn(Math, 'random').mockImplementation(() => samples[sampleIndex++ % samples.length])
    })

    afterEach(() => {
        vi.restoreAllMocks()
        Settings.defaultZone = originalZone
        Settings.now = () => Date.now()
        setSystemTime()
    })

    afterAll(async () => {
        await db.delete(reports)
        Settings.now = () => Date.now()
        setSystemTime()
    })

    it.each([
        ['2024-01-15T07:00:00Z', 8, 1, 4],
        ['2024-07-15T06:00:00Z', 8, 1, 4],
        ['2024-07-15T18:00:00Z', 20, 1, 3],
        ['2024-07-15T19:00:00Z', 21, 1, 1],
        ['2024-07-13T22:30:00Z', 0, 7, 1],
        ['2024-03-31T00:30:00Z', 1, 7, 1],
        ['2024-03-31T01:30:00Z', 3, 7, 1],
        ['2024-10-27T00:30:00Z', 2, 7, 1],
        ['2024-10-27T01:30:00Z', 2, 7, 1],
    ])('uses city service hours at %s in both reports endpoints', async (instant, hour, weekday, threshold) => {
        const now = DateTime.fromISO(instant, { zone: 'utc' })
        setSystemTime(now.toJSDate())
        const getReports = vi.spyOn(ReportsService.prototype, 'getReports')

        // Force an unrelated ambient zone even when workerd ignores the host's TZ.
        for (const processZone of ['UTC', 'Europe/Berlin', 'America/Los_Angeles']) {
            Settings.defaultZone = processZone
            for (const city of ['berlin', 'hamburg', 'leipzig']) {
                for (const path of ['/reports', `/reports/${testStations[0]}`]) {
                    const response = await appRequestWithRedirect(`${path}?city=${city}`)
                    expect(response.status).toBe(200)
                    const currentTime = getReports.mock.lastCall![0].currentTime
                    expect(currentTime.zoneName).toBe('Europe/Berlin')
                    expect(currentTime.toMillis()).toBe(now.toMillis())
                    expect(currentTime.hour).toBe(hour)
                    expect(currentTime.weekday).toBe(weekday)
                    expect(calculatePredictedReportsThreshold(currentTime)).toBe(threshold)
                    const body = (await response.json()) as Array<{ isPredicted: boolean; stationId: string }>
                    expect(body.length).toBeGreaterThan(0)
                    expect(body.length).toBeLessThanOrEqual(threshold)
                    expect(body.every((report) => report.isPredicted)).toBe(true)
                    if (path !== '/reports') {
                        expect(body.every((report) => report.stationId === testStations[0])).toBe(true)
                    }
                }
            }
        }
    })

    it('returns more predicted reports during peak hours than night hours', async () => {
        // Test peak hours - Monday at 15:00 (threshold should be 7)
        const mondayAfternoon = DateTime.utc(2024, 1, 15, 15, 0)
        Settings.now = () => mondayAfternoon.toMillis()

        const fromPeak = mondayAfternoon.minus({ hours: 1 })
        const toPeak = mondayAfternoon.plus({ hours: 1 })

        const responsePeak = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(fromPeak.toISO()!)}&to=${encodeURIComponent(toPeak.toISO()!)}`
        )

        expect(responsePeak.status).toBe(200)
        const peakBody = (await responsePeak.json()) as Array<{ isPredicted: boolean }>
        const peakTotal = peakBody.length

        // Test night hours - Tuesday at 2:00 AM (threshold should be 1)
        const tuesdayNight = DateTime.utc(2024, 1, 16, 2, 0)
        Settings.now = () => tuesdayNight.toMillis()

        const fromNight = tuesdayNight.minus({ hours: 1 })
        const toNight = tuesdayNight.plus({ hours: 1 })

        const responseNight = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(fromNight.toISO()!)}&to=${encodeURIComponent(toNight.toISO()!)}`
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

            const response = await appRequestWithRedirect(
                `/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
            )

            expect(response.status).toBe(200)
            const body = (await response.json()) as Array<{ isPredicted: boolean }>
            const total = body.length

            // Verify threshold is respected
            expect(total).toBeGreaterThanOrEqual(minExpected)
            expect(total).toBeLessThanOrEqual(maxExpected)
        }
    })

    it('prioritizes placing predicted report timestamps early in the time range to appear old', async () => {
        // Mock time to Monday at 12:00
        const mondayNoon = DateTime.utc(2024, 1, 15, 12, 0)
        Settings.now = () => mondayNoon.toMillis()

        // Query for a 2-hour window
        const from = mondayNoon.minus({ hours: 1 })
        const to = mondayNoon.plus({ hours: 1 })

        const response = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
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

describe('Reports by station route', () => {
    let stationOneId: string
    let stationTwoId: string
    let lineId: string

    beforeAll(async () => {
        const [line] = await db.select({ id: lines.id }).from(lines).limit(1)
        lineId = line.id

        const stationRows = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, lineId))
            .limit(2)
        if (stationRows.length < 2) {
            throw new Error('expected at least two stations on the selected line')
        }
        stationOneId = stationRows[0].stationId
        stationTwoId = stationRows[1].stationId
    })

    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(async () => {
        await db.delete(reports)
        Settings.now = () => Date.now()
        setSystemTime()
    })

    it('returns only reports for the requested station in the given timeframe', async () => {
        const now = DateTime.utc(2024, 6, 15, 12, 0, 0)
        const from = now.minus({ minutes: 45 })
        const to = now.plus({ minutes: 1 })

        await sendReportAt(now.minus({ minutes: 30 }).toJSDate(), stationOneId, lineId)
        await sendReportAt(now.minus({ minutes: 20 }).toJSDate(), stationOneId, lineId)
        await sendReportAt(now.minus({ minutes: 10 }).toJSDate(), stationTwoId, lineId)

        setSystemTime(now.toJSDate())

        const response = await appRequestWithRedirect(
            `/reports/${stationOneId}?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
        )

        expect(response.status).toBe(200)

        const body = (await response.json()) as Array<{ stationId: string }>

        expect(body.length).toBe(2)
        expect(body.every((report) => report.stationId === stationOneId)).toBe(true)
    })

    it('fills up with predicted reports when there are not enough real reports for the requested station', async () => {
        // Mock time to peak hours so the threshold is high (7 reports)
        const mondayNoon = DateTime.utc(2024, 1, 15, 12, 0)

        // Seed historical data for stationOneId at matching time patterns (Monday noon, past weeks)
        // so the prediction algorithm guesses stationOneId for the query timeframe
        for (let weeksAgo = 1; weeksAgo <= 2; weeksAgo++) {
            const historicalTime = mondayNoon.minus({ weeks: weeksAgo })
            await sendReportAt(historicalTime.toJSDate(), stationOneId, lineId)
            await sendReportAt(historicalTime.minus({ minutes: 5 }).toJSDate(), stationOneId, lineId)
            await sendReportAt(historicalTime.minus({ minutes: 10 }).toJSDate(), stationOneId, lineId)
        }

        // City-wide history favors another station. A scoped lookup must still use the
        // requested station's history rather than predict globally and discard the result.
        for (let reportIndex = 0; reportIndex < 8; reportIndex++) {
            await sendReportAt(mondayNoon.minus({ weeks: 1, minutes: reportIndex }).toJSDate(), stationTwoId, lineId)
        }

        setSystemTime(mondayNoon.toJSDate())

        // No real reports for stationOneId exist in the query timeframe
        const from = mondayNoon.minus({ hours: 1 })
        const to = mondayNoon.plus({ hours: 1 })

        const response = await appRequestWithRedirect(
            `/reports/${stationOneId}?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
        )

        expect(response.status).toBe(200)

        const body = (await response.json()) as Array<{
            stationId: string
            isPredicted: boolean
        }>

        // The response should contain predicted reports to fill up toward the threshold
        const predictedReports = body.filter((r) => r.isPredicted)
        expect(predictedReports.length).toBeGreaterThan(0)

        // All predicted reports must be for the requested station
        expect(predictedReports.every((r) => r.stationId === stationOneId)).toBe(true)
    })
})

describe('GET reports default-window routing', () => {
    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(() => {
        Settings.now = () => Date.now()
        setSystemTime()
    })

    it('serves explicit rolling 1h requests fresh', async () => {
        const now = DateTime.utc(2024, 1, 15, 12, 0, 0)
        setSystemTime(now.toJSDate())
        const payload = await getValidReportPayload()
        const routeApp = createApp()

        await sendReportAt(now.minus({ minutes: 30 }).toJSDate(), payload.stationId, payload.lineId)

        setSystemTime(now.toJSDate())

        const first = await appRequestWithRedirect('/reports', undefined, routeApp)
        expect(first.status).toBe(200)
        expect(first.headers.get('Cache-Control')).toBe('no-store')
        expect((await getRealReports(first)).length).toBe(1)

        await sendReportAt(now.minus({ minutes: 10 }).toJSDate(), payload.stationId, payload.lineId)

        setSystemTime(now.toJSDate())
        const to = now
        const from = now.minus(DEFAULT_REPORTS_TIMEFRAME)

        const second = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(toIsoSeconds(from))}&to=${encodeURIComponent(toIsoSeconds(to))}`,
            undefined,
            routeApp
        )

        expect(second.status).toBe(200)
        expect((await getRealReports(second)).length).toBe(2)
    })

    it('serves non-default ranges fresh', async () => {
        const now = DateTime.now().toUTC()
        setSystemTime(now.toJSDate())
        const payload = await getValidReportPayload()
        const routeApp = createApp()
        const writerApp = createApp()

        expect((await sendReportRequest(payload, writerApp)).status).toBe(200)

        const first = await appRequestWithRedirect('/reports', undefined, routeApp)
        expect(first.status).toBe(200)
        expect((await getRealReports(first)).length).toBe(1)

        expect((await sendReportRequest(payload, writerApp)).status).toBe(200)
        const to = now
        const from = now.minus({ minutes: 30 })

        const response = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(toIsoSeconds(from))}&to=${encodeURIComponent(toIsoSeconds(to))}`,
            undefined,
            routeApp
        )

        expect(response.status).toBe(200)
        expect((await getRealReports(response)).length).toBe(2)
    })

    it('reflects newly posted reports in the default window', async () => {
        const now = DateTime.now().toUTC()
        setSystemTime(now.toJSDate())
        const payload = await getValidReportPayload()

        const routeApp = createApp()

        expect((await sendReportRequest(payload, routeApp)).status).toBe(200)

        const first = await appRequestWithRedirect('/reports', undefined, routeApp)
        expect(first.status).toBe(200)
        expect((await getRealReports(first)).length).toBe(1)

        const postResponse = await sendReportRequest(payload, routeApp)
        expect(postResponse.status).toBe(200)

        const second = await appRequestWithRedirect('/reports', undefined, routeApp)
        expect(second.status).toBe(200)
        expect((await getRealReports(second)).length).toBe(2)
    })
})

describe('Report decay', () => {
    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(async () => {
        await db.delete(reports)
        Settings.now = () => Date.now()
        setSystemTime()
    })

    it('stamps real reports with an expiry, in the past once they are no longer live', async () => {
        const now = DateTime.utc(2024, 1, 15, 12, 0, 0)

        // Well within the burst-adaptive ttl (max 45min in a quiet period)
        await sendReportAt(now.minus({ minutes: 10 }).toJSDate())
        // Past its ttl, so it is no longer live — but still returned
        await sendReportAt(now.minus({ minutes: 70 }).toJSDate())

        setSystemTime(now.toJSDate())
        const from = now.minus({ hours: 4 })
        const to = now.plus({ minutes: 1 })

        const response = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
        )

        expect(response.status).toBe(200)
        const realReports = await getRealReports(response)

        expect(realReports.length).toBe(2)

        const expiries = realReports.map((report) => new Date(report.expiresAt!).getTime() > now.toMillis()).sort()
        expect(expiries).toEqual([false, true])
    })

    // The line/station panels ask for the last 24h and the station counter for the last 7d, through
    // this same endpoint. Every report in those windows is long expired, so annotating rather than
    // dropping is what keeps them populated.
    it('returns long-expired reports so historical windows are not emptied', async () => {
        const now = DateTime.utc(2024, 1, 15, 12, 0, 0)

        for (const hoursAgo of [2, 6, 20]) {
            await sendReportAt(now.minus({ hours: hoursAgo }).toJSDate())
        }

        setSystemTime(now.toJSDate())
        // The older 24h-to-1h remainder slice the frontend fetches alongside the live last hour.
        const from = now.minus({ hours: 24 })
        const to = now.minus({ hours: 1 })

        const response = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
        )

        expect(response.status).toBe(200)
        const realReports = await getRealReports(response)

        expect(realReports.length).toBe(3)
        expect(realReports.every((report) => new Date(report.expiresAt!).getTime() <= now.toMillis())).toBe(true)
    })

    // Predictions exist to fill a genuine hole in the data. A window full of expired reports is not
    // a hole — decay hiding stale reports is a statement about them, not missing data — so it must
    // not be answered with synthesised ones.
    it('does not backfill a historical window that already has real reports', async () => {
        const now = DateTime.utc(2024, 1, 15, 12, 0)

        for (const hoursAgo of [2, 6, 20]) {
            await sendReportAt(now.minus({ hours: hoursAgo }).toJSDate())
        }

        setSystemTime(now.toJSDate())
        const from = now.minus({ hours: 24 })
        const to = now.minus({ hours: 1 })

        const response = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
        )

        expect(response.status).toBe(200)
        const body = (await response.json()) as Array<{ isPredicted: boolean }>

        expect(body.filter((report) => report.isPredicted)).toHaveLength(0)
    })

    it('gives predicted reports no expiry at all', async () => {
        const mondayNoon = DateTime.utc(2024, 1, 15, 12, 0) // peak hours -> high predicted threshold

        // Historic reports at the same time-of-day in past weeks so the prediction algorithm has
        // A pattern to guess from.
        for (let weeksAgo = 1; weeksAgo <= 2; weeksAgo++) {
            const historicTime = mondayNoon.minus({ weeks: weeksAgo })
            await sendReportAt(historicTime.toJSDate())
            await sendReportAt(historicTime.minus({ minutes: 5 }).toJSDate())
        }

        setSystemTime(mondayNoon.toJSDate())

        const from = mondayNoon.minus({ hours: 1 })
        const to = mondayNoon.plus({ hours: 1 })

        const response = await appRequestWithRedirect(
            `/reports?from=${encodeURIComponent(from.toISO()!)}&to=${encodeURIComponent(to.toISO()!)}`
        )

        expect(response.status).toBe(200)
        const body = (await response.json()) as Array<{ isPredicted: boolean; expiresAt: string | null }>
        const predicted = body.filter((report) => report.isPredicted)

        expect(predicted.length).toBeGreaterThan(0)
        expect(predicted.every((report) => report.expiresAt === null)).toBe(true)
    })
})
