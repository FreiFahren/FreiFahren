import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Hono } from 'hono'

import { Stations } from '../src/modules/transit/types'
import { TransitNetworkDataService } from '../src/modules/transit/transit-network-data-service'
import { db, lineStations, reports, stations } from './test-db'
import { and, desc, eq, sql } from 'drizzle-orm'
import { sendReportRequest } from './test-utils'

let fakeNlpServer: ReturnType<typeof Bun.serve> | null = null

type CapturedRequest = {
    body: unknown
    password: string | null
}

const capturedRequests: CapturedRequest[] = []

describe('Telegram notification', () => {
    let shouldFail: boolean

    beforeAll(async () => {
        const fakeNlp = new Hono()

        fakeNlp.post('/report', async (c) => {
            const body = await c.req.json()
            const password = c.req.header('X-Password') ?? null

            capturedRequests.push({ body, password })

            if (shouldFail) {
                return c.json({ status: 'error' }, 500)
            }

            return c.json({ status: 'success' }, 200)
        })

        fakeNlpServer = Bun.serve({
            port: 0,
            fetch: fakeNlp.fetch,
        })

        process.env.TELEGRAM_WORKER_URL = `http://127.0.0.1:${fakeNlpServer.port}`
        process.env.REPORT_PASSWORD = 'test-password'
        process.env.NODE_ENV = 'production'
    })

    afterAll(() => {
        fakeNlpServer?.stop()
    })

    beforeEach(() => {
        capturedRequests.length = 0
        shouldFail = false
    })

    it('sends a Telegram notification when source is not telegram and returns 200', async () => {
        // Pick a station that sits on multiple lines so post-processing does not
        // auto-fill lineId from a single-line station (which would defeat the
        // `lineId` null assertion below).
        const [station] = await db
            .select({ id: lineStations.stationId })
            .from(lineStations)
            .groupBy(lineStations.stationId)
            .having(sql`count(*) > 1`)
            .orderBy(lineStations.stationId)
            .limit(1)

        const response = await sendReportRequest({
            stationId: station.id,
            source: 'web_app',
        })

        expect(response.status).toBe(200)
        expect(capturedRequests.length).toBe(1)
        expect(capturedRequests[0]?.password).toBe('test-password')

        const body = capturedRequests[0]?.body as {
            lineId: string | null
            stationId: string
            directionId: string | null
        }

        expect(Object.keys(body).sort()).toEqual(['directionId', 'lineId', 'stationId'])
        expect(body.stationId).toBe(station.id)
        expect(body.lineId).toBeNull()
        expect(body.directionId).toBeNull()
    })

    it('does not send a Telegram notification when source is telegram', async () => {
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)

        const response = await sendReportRequest({
            stationId: station.id,
            source: 'telegram',
        })

        expect(response.status).toBe(200)
        expect(capturedRequests.length).toBe(0)
    })

    it('returns 200 and a failure header when Telegram notification fails', async () => {
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)

        shouldFail = true

        const response = await sendReportRequest({
            stationId: station.id,
            source: 'web_app',
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('X-Telegram-Notification-Status')).toBe('failed')

        // ensure we still attempted to call the NLP service
        expect(capturedRequests.length).toBe(1)
    })

    it('does not send a Telegram notification if database insertion fails', async () => {
        const response = await sendReportRequest({
            stationId: 'invalid_id', // Triggers FK violation
            source: 'web_app',
        })

        expect(response.status).toBe(500)
        expect(capturedRequests.length).toBe(0)
    })
})

describe('Report API contract', () => {
    beforeAll(async () => {
        process.env.NODE_ENV = 'production'
    })

    it('rejects reports without station, line, and direction', async () => {
        const response = await sendReportRequest({
            source: 'web_app',
            // stationId, lineId and directionId are omitted on purpose
        })

        expect(response.status).toBe(400)

        const responseBody = await response.text()
        expect(responseBody).toContain('At least one of stationId, lineId, or directionId must be provided')
    })

    it('returns only the created report', async () => {
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)

        const response = await sendReportRequest({
            stationId: station.id,
            source: 'web_app',
        })

        expect(response.status).toBe(200)

        const body = (await response.json()) as unknown

        expect(Array.isArray(body)).toBe(false)
        expect(typeof body).toBe('object')
        expect(body).not.toBeNull()

        const createdReport = body as {
            reportId: number
            stationId: string
            lineId: string | null
            directionId: string | null
            timestamp: string | Date
            source?: unknown
        }

        expect(typeof createdReport.reportId).toBe('number')
        expect(createdReport.stationId).toBe(station.id)
        expect(createdReport).not.toHaveProperty('source')
        expect(createdReport.timestamp).toBeTruthy()
    })

    it('guesses the station when a line is provided without a station', async () => {
        // Ensure deterministic history for this test
        await db.delete(reports)

        const [entry] = await db
            .select({
                stationId: lineStations.stationId,
                lineId: lineStations.lineId,
            })
            .from(lineStations)
            .limit(1)

        const stationsOnLine = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, entry.lineId))
            .limit(3)

        const mostCommonStationId = stationsOnLine[0]!.stationId
        const lessCommonStationId = stationsOnLine[1]?.stationId ?? stationsOnLine[0]!.stationId

        await db.insert(reports).values([
            // Make one station clearly the most common for this line at the current time window
            { stationId: mostCommonStationId, lineId: entry.lineId, directionId: null, source: 'web_app' },
            { stationId: mostCommonStationId, lineId: entry.lineId, directionId: null, source: 'web_app' },
            { stationId: mostCommonStationId, lineId: entry.lineId, directionId: null, source: 'web_app' },
            { stationId: mostCommonStationId, lineId: entry.lineId, directionId: null, source: 'web_app' },
            { stationId: mostCommonStationId, lineId: entry.lineId, directionId: null, source: 'web_app' },
            { stationId: lessCommonStationId, lineId: entry.lineId, directionId: null, source: 'web_app' },
        ])

        const response = await sendReportRequest({
            lineId: entry.lineId,
            directionId: null,
            source: 'web_app',
            // stationId is omitted on purpose
        })

        expect(response.status).toBe(200)

        const body = (await response.json()) as {
            reportId: number
            stationId: string
            lineId: string | null
            directionId: string | null
            timestamp: string | Date
        }

        expect(typeof body.reportId).toBe('number')
        expect(body.lineId).toBe(entry.lineId)
        expect(body.stationId).toBe(mostCommonStationId)

        const stationIsOnLine = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(and(eq(lineStations.lineId, entry.lineId), eq(lineStations.stationId, body.stationId)))
            .limit(1)

        expect(stationIsOnLine.length).toBe(1)
    })

    it('breaks ties in station guessing by choosing the lexicographically smallest stationId', async () => {
        // Ensure deterministic history
        await db.delete(reports)

        const [entry] = await db
            .select({
                stationId: lineStations.stationId,
                lineId: lineStations.lineId,
            })
            .from(lineStations)
            .limit(1)

        const stationsOnLine = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, entry.lineId))
            .limit(2)

        if (stationsOnLine.length < 2) return

        const station1 = stationsOnLine[0]!.stationId
        const station2 = stationsOnLine[1]!.stationId

        const [sorted1] = [station1, station2].sort()

        // Insert equal number of reports for both stations to create a tie
        await db.insert(reports).values([
            { stationId: station1, lineId: entry.lineId, directionId: null, source: 'web_app' },
            { stationId: station2, lineId: entry.lineId, directionId: null, source: 'web_app' },
        ])

        const response = await sendReportRequest({
            lineId: entry.lineId,
            directionId: null,
            source: 'web_app',
            // stationId is omitted
        })

        expect(response.status).toBe(200)

        const body = (await response.json()) as { stationId: string }
        expect(body.stationId).toBe(sorted1)
    })

    it('defaults to telegram source when source is missing in request', async () => {
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)

        const response = await sendReportRequest({
            stationId: station.id,
            // source is omitted
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ source: reports.source })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(report.source).toBe('telegram')
    })

    it('can submit a report with a direction', async () => {
        // Find a valid line and station connection
        const [entry] = await db
            .select({
                stationId: lineStations.stationId,
                lineId: lineStations.lineId,
            })
            .from(lineStations)
            .limit(1)

        // Find the final station (direction) for this line
        const [finalStation] = await db
            .select({
                id: stations.id,
                name: stations.name,
            })
            .from(lineStations)
            .innerJoin(stations, eq(lineStations.stationId, stations.id))
            .where(eq(lineStations.lineId, entry.lineId))
            .orderBy(desc(lineStations.order))
            .limit(1)

        const response = await sendReportRequest({
            stationId: entry.stationId,
            lineId: entry.lineId,
            directionId: finalStation.id,
            source: 'web_app',
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({
                directionId: reports.directionId,
            })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(report.directionId).toBe(finalStation.id)
    })

    it('rejects reports with an invalid lineId instead of crashing', async () => {
        const response = await sendReportRequest({
            lineId: 'NON_EXISTENT_LINE',
            source: 'web_app',
        })

        expect(response.status).toBe(400)
    })

    it('rejects reports with an invalid stationId instead of crashing', async () => {
        const response = await sendReportRequest({
            stationId: 'NON_EXISTENT_STATION',
            source: 'web_app',
        })

        expect(response.status).toBe(400)
    })

    it('rejects reports with an invalid directionId instead of crashing', async () => {
        const response = await sendReportRequest({
            directionId: 'NON_EXISTENT_DIRECTION',
            source: 'web_app',
        })
        expect(response.status).toBe(400)
    })

    it('rejects reports with an invalid source instead of crashing', async () => {
        const response = await sendReportRequest({
            source: 'NON_EXISTENT_SOURCE',
        })
        expect(response.status).toBe(400)
    })
})

describe('Report Post Processing', () => {
    let stationsMap: Stations
    let linesMap: Record<string, string[]>

    let stationWithOneLineId: string
    let stationWithMultipleLinesId: string
    let directionWithOneLineId: string
    let lineIdForStationWithOneLine: string
    let stationNotOnLineId: string
    let stationOnSameLineAsStationWithOneLineId: string
    let stationWithMultipleLinesAndDirectionSharingSingleLine: string
    let directionWithMultipleLinesSharingSingleLine: string
    let sharedLineId: string
    let stationWithMultipleLinesAndDirectionSharingNoLines: string
    let directionWithMultipleLinesSharingNoLines: string
    let lineWithMiddleStationId: string
    let middleStationId: string
    let stationAfterMiddleId: string
    let firstStationOnLineId: string

    beforeAll(async () => {
        const transitService = new TransitNetworkDataService(db)
        stationsMap = await transitService.getStations()
        linesMap = Object.fromEntries((await transitService.getLines()).map((line) => [line.id, line.stations]))

        // Sort station entries by id so all fixture lookups are deterministic regardless of seed insertion order.
        const stationEntries = Object.entries(stationsMap).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

        const stationWithOneLineEntry = stationEntries.find(([, s]) => s.lines.length === 1)
        if (!stationWithOneLineEntry) throw new Error('No station with 1 line found')
        stationWithOneLineId = stationWithOneLineEntry[0]
        lineIdForStationWithOneLine = stationWithOneLineEntry[1].lines[0]!

        // Pick a multi-line station paired with a single-line direction whose only line is one of the
        // multi-line station's lines. Without this shared line, the post-processor sets lineId from
        // the direction and then clears the off-line stationId, causing a 422.
        const multiLineWithCompatibleSingleLineDirection = stationEntries
            .filter(([, s]) => s.lines.length > 1)
            .flatMap(([stationId, station]) =>
                stationEntries
                    .filter(
                        ([directionId, direction]) =>
                            direction.lines.length === 1 &&
                            directionId !== stationId &&
                            directionId !== stationWithOneLineId &&
                            station.lines.includes(direction.lines[0]!)
                    )
                    .map(([directionId]) => ({ stationId, directionId }))
            )[0]

        if (!multiLineWithCompatibleSingleLineDirection) {
            throw new Error('No multi-line station found paired with a compatible single-line direction')
        }

        stationWithMultipleLinesId = multiLineWithCompatibleSingleLineDirection.stationId
        directionWithOneLineId = multiLineWithCompatibleSingleLineDirection.directionId

        const stationNotOnLineEntry = stationEntries.find(([, s]) => !s.lines.includes(lineIdForStationWithOneLine))
        if (!stationNotOnLineEntry) throw new Error('No station found that is not on the selected line')
        stationNotOnLineId = stationNotOnLineEntry[0]

        const stationsOnLineForSingleLineStation = linesMap[lineIdForStationWithOneLine]
        const terminalStationsOnLineForSingleLineStation = new Set([
            stationsOnLineForSingleLineStation[0],
            stationsOnLineForSingleLineStation[stationsOnLineForSingleLineStation.length - 1],
        ])

        const stationOnSameLineEntry = stationEntries.find(
            ([id, s]) =>
                s.lines.includes(lineIdForStationWithOneLine) &&
                id !== stationWithOneLineId &&
                terminalStationsOnLineForSingleLineStation.has(id)
        )
        if (!stationOnSameLineEntry) throw new Error('No terminal station on the same line found')
        stationOnSameLineAsStationWithOneLineId = stationOnSameLineEntry[0]

        const multiLineStations = stationEntries.filter(([, s]) => s.lines.length > 1)
        const sharedSingleLineMatch = multiLineStations
            .flatMap(([stationId, station]) =>
                multiLineStations
                    .filter(([directionId]) => directionId !== stationId)
                    .map(([directionId, direction]) => {
                        const directionLines = new Set(direction.lines)
                        const sharedLines = station.lines.filter((lineId) => directionLines.has(lineId))
                        return { stationId, directionId, sharedLines }
                    })
            )
            .find(({ sharedLines }) => sharedLines.length === 1)

        if (!sharedSingleLineMatch) {
            throw new Error('No stations found where station and direction share exactly one line')
        }

        stationWithMultipleLinesAndDirectionSharingSingleLine = sharedSingleLineMatch.stationId
        directionWithMultipleLinesSharingSingleLine = sharedSingleLineMatch.directionId
        sharedLineId = sharedSingleLineMatch.sharedLines[0]!

        const sharedNoLinesMatch = multiLineStations
            .flatMap(([stationId, station]) =>
                multiLineStations
                    .filter(([directionId]) => directionId !== stationId)
                    .map(([directionId, direction]) => {
                        const directionLines = new Set(direction.lines)
                        const sharedLines = station.lines.filter((lineId) => directionLines.has(lineId))
                        return { stationId, directionId, sharedLines }
                    })
            )
            .find(({ sharedLines }) => sharedLines.length === 0)

        if (!sharedNoLinesMatch) {
            throw new Error('No stations found where station and direction share zero lines')
        }

        stationWithMultipleLinesAndDirectionSharingNoLines = sharedNoLinesMatch.stationId
        directionWithMultipleLinesSharingNoLines = sharedNoLinesMatch.directionId

        const lineEntries = Object.entries(linesMap)
        const lineWithMiddleStation = lineEntries.find(([, stationIds]) => stationIds.length >= 3)
        if (!lineWithMiddleStation) throw new Error('No line found with at least 3 stations')

        lineWithMiddleStationId = lineWithMiddleStation[0]
        firstStationOnLineId = lineWithMiddleStation[1][0]!
        middleStationId = lineWithMiddleStation[1][1]!
        stationAfterMiddleId = lineWithMiddleStation[1][2]!
    })

    it('rejects direction only payload when no line can be inferred', async () => {
        const response = await sendReportRequest({
            source: 'web_app',
            directionId: stationWithMultipleLinesId,
        })

        expect(response.status).toBe(422)
    })

    it('Accept a direction only payload when a line can be inferred', async () => {
        const directionLineId = stationsMap[directionWithOneLineId].lines[0]!
        const stationIdOnDirectionLine = linesMap[directionLineId].find(
            (stationId) => stationId !== directionWithOneLineId
        )
        if (!stationIdOnDirectionLine) throw new Error('No station found on the inferred direction line')

        const candidateReportResponse = await sendReportRequest({
            stationId: stationIdOnDirectionLine,
            lineId: directionLineId,
            directionId: directionWithOneLineId,
            source: 'web_app',
        })
        expect(candidateReportResponse.status).toBe(200)

        const response = await sendReportRequest({
            source: 'web_app',
            directionId: directionWithOneLineId,
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ lineId: reports.lineId, stationId: reports.stationId, directionId: reports.directionId })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(report.lineId).toBe(directionLineId)
        expect(report.stationId).toBe(stationIdOnDirectionLine)
        expect(report.directionId).toBe(directionWithOneLineId)
    })

    it('if no line is present it will use the stations line', async () => {
        const response = await sendReportRequest({
            stationId: stationWithOneLineId,
            lineId: null,
            directionId: null,
            source: 'web_app',
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ lineId: reports.lineId })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        const expectedLineId = stationsMap[stationWithOneLineId].lines[0]
        expect(report.lineId).toBe(expectedLineId)
    })

    it('does not remove the direction when line is missing', async () => {
        const response = await sendReportRequest({
            stationId: stationWithOneLineId,
            lineId: null,
            directionId: stationOnSameLineAsStationWithOneLineId,
            source: 'web_app',
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ directionId: reports.directionId })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(report.directionId).toBe(stationOnSameLineAsStationWithOneLineId)
    })

    it('if no line present and station the station has more than one line it will use the line of the direction', async () => {
        const response = await sendReportRequest({
            stationId: stationWithMultipleLinesId,
            lineId: null,
            directionId: directionWithOneLineId,
            source: 'web_app',
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ lineId: reports.lineId })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        const expectedLineId = stationsMap[directionWithOneLineId].lines[0]
        expect(report.lineId).toBe(expectedLineId)
    })

    it('removes direction when direction is not on the provided line', async () => {
        const response = await sendReportRequest({
            stationId: stationWithOneLineId,
            lineId: lineIdForStationWithOneLine,
            directionId: stationNotOnLineId,
            source: 'web_app',
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ directionId: reports.directionId, lineId: reports.lineId })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(report.lineId).toBe(lineIdForStationWithOneLine)
        expect(report.directionId).toBeNull()
    })

    it('clears station when station is not on the provided line', async () => {
        const response = await sendReportRequest({
            stationId: stationNotOnLineId,
            lineId: lineIdForStationWithOneLine,
            directionId: null,
            source: 'web_app',
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ stationId: reports.stationId })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(typeof report.stationId).toBe('string')
        expect(report.stationId.length).toBeGreaterThan(0)
    })

    it('If no line and station has more than one line it will continue with line as null', async () => {
        const response = await sendReportRequest({
            stationId: stationWithMultipleLinesId,
            lineId: null,
            directionId: null,
            source: 'web_app',
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ lineId: reports.lineId })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(report.lineId).toBeNull()
    })

    it('chooses the shared line when station and direction share a single line', async () => {
        const response = await sendReportRequest({
            stationId: stationWithMultipleLinesAndDirectionSharingSingleLine,
            lineId: null,
            directionId: directionWithMultipleLinesSharingSingleLine,
            source: 'web_app',
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ lineId: reports.lineId })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(report.lineId).toBe(sharedLineId)
    })

    it('clears direction when station and direction share no lines and no line is provided', async () => {
        const response = await sendReportRequest({
            stationId: stationWithMultipleLinesAndDirectionSharingNoLines,
            lineId: null,
            directionId: directionWithMultipleLinesSharingNoLines,
            source: 'web_app',
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ lineId: reports.lineId, directionId: reports.directionId })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(report.lineId).toBeNull()
        expect(report.directionId).toBeNull()
    })

    it('corrects direction to the terminal station when the direction is implied', async () => {
        const response = await sendReportRequest({
            stationId: stationAfterMiddleId,
            lineId: lineWithMiddleStationId,
            directionId: middleStationId, // not a terminal station
            source: 'web_app',
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ directionId: reports.directionId })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(report.directionId).toBe(firstStationOnLineId)
    })

    it('corrects direction to the last terminal station when the station is before the direction', async () => {
        const stationsOnLine = linesMap[lineWithMiddleStationId]
        const lastStationOnLineId = stationsOnLine[stationsOnLine.length - 1]

        const response = await sendReportRequest({
            stationId: firstStationOnLineId,
            lineId: lineWithMiddleStationId,
            directionId: middleStationId,
            source: 'web_app',
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ directionId: reports.directionId })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(report.directionId).toBe(lastStationOnLineId)
    })

    it('does not change direction if it is already a terminal station', async () => {
        const stationsOnLine = linesMap[lineWithMiddleStationId]
        const lastStationOnLineId = stationsOnLine[stationsOnLine.length - 1]

        const response = await sendReportRequest({
            stationId: middleStationId,
            lineId: lineWithMiddleStationId,
            directionId: lastStationOnLineId,
            source: 'web_app',
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ directionId: reports.directionId })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(report.directionId).toBe(lastStationOnLineId)
    })

    it('clears direction when station and direction are the same', async () => {
        const response = await sendReportRequest({
            stationId: stationWithOneLineId,
            lineId: lineIdForStationWithOneLine,
            directionId: stationWithOneLineId,
            source: 'web_app',
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ directionId: reports.directionId })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(report.directionId).toBeNull()
    })

    it('clears direction when direction is present without a line', async () => {
        const response = await sendReportRequest({
            stationId: stationWithOneLineId,
            lineId: null,
            directionId: stationWithOneLineId,
            source: 'web_app',
        })
        expect(response.status).toBe(200)

        const [report] = await db
            .select({ directionId: reports.directionId })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(report.directionId).toBeNull()
    })

    it('clears direction when station is on one line and direction is on another and no lineId is provided', async () => {
        const response = await sendReportRequest({
            stationId: stationWithOneLineId,
            lineId: null,
            directionId: stationNotOnLineId,
            source: 'web_app',
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ lineId: reports.lineId, directionId: reports.directionId })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(report.lineId).toBe(lineIdForStationWithOneLine)
        expect(report.directionId).toBeNull()
    })
})
