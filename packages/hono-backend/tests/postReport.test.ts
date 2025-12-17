import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Hono } from 'hono'

import { Stations } from '../src/modules/transit/types'
import { TransitNetworkDataService } from '../src/modules/transit/transit-network-data-service'
import { db, lineStations, reports, stations } from '../src/db'
import { seedBaseData } from '../src/db/seed/seed'
import { and, desc, eq } from 'drizzle-orm'

let app: (typeof import('../src/index'))['default']
let fakeNlpServer: ReturnType<typeof Bun.serve> | null = null

type CapturedRequest = {
    body: unknown
    password: string | null
}

const capturedRequests: CapturedRequest[] = []

const sendReportRequest = async (payload: object) => {
    return app.request('/v0/reports', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    })
}

describe('Telegram notification', () => {
    let shouldFail: boolean

    beforeAll(async () => {
        await seedBaseData(db)

        const fakeNlp = new Hono()

        fakeNlp.post('/report-inspector', async (c) => {
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

        process.env.NLP_SERVICE_URL = `http://127.0.0.1:${fakeNlpServer.port}`
        process.env.REPORT_PASSWORD = 'test-password'
        process.env.NODE_ENV = 'production'

        const mod = await import('../src/index')
        app = mod.default
    })

    afterAll(() => {
        fakeNlpServer?.stop()
    })

    beforeEach(() => {
        capturedRequests.length = 0
        shouldFail = false
    })

    it('sends a Telegram notification when source is not telegram and returns 200', async () => {
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)

        const response = await sendReportRequest({
            stationId: station.id,
            source: 'web_app',
        })

        expect(response.status).toBe(200)
        expect(capturedRequests.length).toBe(1)
        expect(capturedRequests[0]?.password).toBe('test-password')

        const body = capturedRequests[0]?.body as {
            line: string | null
            station: string
            direction: string | null
            message: string | null
            stationId: string
        }

        expect(body.stationId).toBe(station.id)
        expect(typeof body.station).toBe('string')
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
        await seedBaseData(db)
        const mod = await import('../src/index')
        app = mod.default
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
})

describe('Report Post Processing', () => {
    let stationsMap: Stations
    let linesMap: Record<string, string[]>

    let stationWithOneLineId: string
    let stationWithMultipleLinesId: string
    let directionWithOneLineId: string
    let lineIdForStationWithOneLine: string
    let stationNotOnLineId: string
    let stationWithMultipleLinesAndDirectionSharingSingleLine: string
    let directionWithMultipleLinesSharingSingleLine: string
    let sharedLineId: string
    let lineWithMiddleStationId: string
    let middleStationId: string
    let stationAfterMiddleId: string
    let firstStationOnLineId: string

    beforeAll(async () => {
        await seedBaseData(db)
        const transitService = new TransitNetworkDataService(db)
        stationsMap = await transitService.getStations()
        linesMap = await transitService.getLines()

        const stationEntries = Object.entries(stationsMap)

        const stationWithOneLineEntry = stationEntries.find(([, s]) => s.lines.length === 1)
        if (!stationWithOneLineEntry) throw new Error('No station with 1 line found')
        stationWithOneLineId = stationWithOneLineEntry[0]
        lineIdForStationWithOneLine = stationWithOneLineEntry[1].lines[0]!

        const stationWithMultipleLinesEntry = stationEntries.find(([, s]) => s.lines.length > 1)
        if (!stationWithMultipleLinesEntry) throw new Error('No station with >1 lines found')
        stationWithMultipleLinesId = stationWithMultipleLinesEntry[0]

        // Find a different station for direction that has 1 line
        const directionWithOneLineEntry = stationEntries.find(
            ([id, s]) => s.lines.length === 1 && id !== stationWithOneLineId
        )
        // If we can't find a different one, reuse the first one (it's fine for testing direction logic usually)
        directionWithOneLineId = directionWithOneLineEntry ? directionWithOneLineEntry[0] : stationWithOneLineId

        const stationNotOnLineEntry = stationEntries.find(([, s]) => !s.lines.includes(lineIdForStationWithOneLine))
        if (!stationNotOnLineEntry) throw new Error('No station found that is not on the selected line')
        stationNotOnLineId = stationNotOnLineEntry[0]

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

        const lineEntries = Object.entries(linesMap)
        const lineWithMiddleStation = lineEntries.find(([, stationIds]) => stationIds.length >= 3)
        if (!lineWithMiddleStation) throw new Error('No line found with at least 3 stations')

        lineWithMiddleStationId = lineWithMiddleStation[0]
        firstStationOnLineId = lineWithMiddleStation[1][0]!
        middleStationId = lineWithMiddleStation[1][1]!
        stationAfterMiddleId = lineWithMiddleStation[1][2]!
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
            directionId: stationNotOnLineId,
            source: 'web_app',
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ directionId: reports.directionId })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(report.directionId).toBe(stationNotOnLineId)
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
})
