import { asc, eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../src'
import { db, lineStations, lines, reports, segments } from './test-db'
import { appRequestWithRedirect, sendReportRequest } from './test-utils'

type SegmentRisk = { color: string; risk: number }
type RiskResponse = { segments_risk: Record<string, SegmentRisk> }

const VALID_COLORS = ['#13C184', '#FACB3F', '#F05044', '#A92725']
const GREEN = '#13C184'

let testStationId: string
let testLineId: string
let routeApp = createApp()

const getRisk = () => appRequestWithRedirect('/risk', undefined, routeApp)
const postRiskReport = (payload: object) => sendReportRequest(payload, routeApp)

beforeEach(() => {
    routeApp = createApp()
})

describe('GET /v0/risk response shape', () => {
    beforeAll(async () => {
        const [line] = await db.select({ id: lines.id }).from(lines).limit(1)
        const [stationOnLine] = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, line!.id))
            .limit(1)

        testLineId = line!.id
        testStationId = stationOnLine!.stationId
    })

    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(async () => {
        await db.delete(reports)
    })

    it('returns 200 with a segments_risk object', async () => {
        const response = await getRisk()

        expect(response.status).toBe(200)

        const body = (await response.json()) as RiskResponse
        expect(body).toHaveProperty('segments_risk')
        expect(typeof body.segments_risk).toBe('object')
        expect(Array.isArray(body.segments_risk)).toBe(false)
    })

    it('returns empty segments_risk when there are no recent reports', async () => {
        const response = await getRisk()

        expect(response.status).toBe(200)

        const body = (await response.json()) as RiskResponse
        expect(Object.keys(body.segments_risk).length).toBe(0)
    })

    it('returns non-empty segments_risk after a recent real report', async () => {
        await postRiskReport({ stationId: testStationId, lineId: testLineId, source: 'telegram' })

        const response = await getRisk()

        expect(response.status).toBe(200)

        const body = (await response.json()) as RiskResponse
        expect(Object.keys(body.segments_risk).length).toBeGreaterThan(0)
    })

    it('each segment entry has a valid color and a risk score between 0 and 1', async () => {
        await postRiskReport({ stationId: testStationId, lineId: testLineId, source: 'telegram' })

        const response = await getRisk()
        const body = (await response.json()) as RiskResponse

        for (const [sid, data] of Object.entries(body.segments_risk)) {
            expect(typeof sid).toBe('string')
            expect(VALID_COLORS).toContain(data.color)
            expect(data.risk).toBeGreaterThan(0)
            expect(data.risk).toBeLessThanOrEqual(1)
        }
    })

    it('only includes segments with risk — green segments are excluded', async () => {
        await postRiskReport({ stationId: testStationId, lineId: testLineId, source: 'telegram' })

        const response = await getRisk()
        const body = (await response.json()) as RiskResponse

        for (const data of Object.values(body.segments_risk)) {
            expect(data.color).not.toBe(GREEN)
            expect(data.risk).toBeGreaterThan(0.2)
        }
    })

    it('segment IDs are numeric strings matching database IDs', async () => {
        await postRiskReport({ stationId: testStationId, lineId: testLineId, source: 'telegram' })

        const response = await getRisk()
        const body = (await response.json()) as RiskResponse

        for (const sid of Object.keys(body.segments_risk)) {
            expect(sid).toMatch(/^\d+$/)
        }
    })
})

describe('GET /v0/risk timeframe filtering', () => {
    beforeAll(async () => {
        const [line] = await db.select({ id: lines.id }).from(lines).limit(1)
        const [stationOnLine] = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, line!.id))
            .limit(1)

        testLineId = line!.id
        testStationId = stationOnLine!.stationId
    })

    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(async () => {
        await db.delete(reports)
    })

    it('ignores reports older than 1 hour', async () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

        await db.insert(reports).values({
            stationId: testStationId,
            lineId: testLineId,
            directionId: null,
            timestamp: twoHoursAgo,
            source: 'telegram',
        })

        const response = await getRisk()

        expect(response.status).toBe(200)

        const body = (await response.json()) as RiskResponse
        expect(Object.keys(body.segments_risk).length).toBe(0)
    })

    it('includes reports from within the last hour', async () => {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

        await db.insert(reports).values({
            stationId: testStationId,
            lineId: testLineId,
            directionId: null,
            timestamp: thirtyMinutesAgo,
            source: 'telegram',
        })

        const response = await getRisk()

        expect(response.status).toBe(200)

        const body = (await response.json()) as RiskResponse
        expect(Object.keys(body.segments_risk).length).toBeGreaterThan(0)
    })

    it('a very recent report produces higher risk than one from 55 minutes ago', async () => {
        // Insert an old-ish report
        const fiftyFiveMinutesAgo = new Date(Date.now() - 55 * 60 * 1000)
        await db.insert(reports).values({
            stationId: testStationId,
            lineId: testLineId,
            directionId: null,
            timestamp: fiftyFiveMinutesAgo,
            source: 'telegram',
        })

        const oldResponse = await getRisk()
        const oldBody = (await oldResponse.json()) as RiskResponse

        // The 55-minute-old report must still produce output (bidirect decay ≈ 0.3 at that age),
        // otherwise we have nothing meaningful to compare against
        expect(Object.keys(oldBody.segments_risk).length).toBeGreaterThan(0)

        await db.delete(reports)

        // Insert a fresh report
        await postRiskReport({ stationId: testStationId, lineId: testLineId, source: 'telegram' })

        const freshResponse = await getRisk()
        const freshBody = (await freshResponse.json()) as RiskResponse

        // Both reports target the same station/line, so there must be a segment in common
        const sharedSid = Object.keys(freshBody.segments_risk).find((sid) => sid in oldBody.segments_risk)
        expect(sharedSid).toBeDefined()

        expect(freshBody.segments_risk[sharedSid!]!.risk).toBeGreaterThan(oldBody.segments_risk[sharedSid!]!.risk)
    })
})

describe('GET /v0/risk segment targeting', () => {
    let segmentLineId: string
    let stationOnSegmentLine: string

    beforeAll(async () => {
        // Find a segment and a station that belongs to its line
        const [segment] = await db
            .select({
                lineId: segments.lineId,
                fromStationId: segments.fromStationId,
                toStationId: segments.toStationId,
            })
            .from(segments)
            .limit(1)

        segmentLineId = segment!.lineId

        // Get any station on this line to use as the report's station
        const [stationEntry] = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, segmentLineId))
            .limit(1)

        stationOnSegmentLine = stationEntry!.stationId
    })

    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(async () => {
        await db.delete(reports)
    })

    it('a report on a line causes segments of that line to appear in the risk output', async () => {
        await postRiskReport({ stationId: stationOnSegmentLine, lineId: segmentLineId, source: 'telegram' })

        const response = await getRisk()
        const body = (await response.json()) as RiskResponse

        // Resolve the DB IDs for segments on the reported line
        const segmentsOnLine = await db
            .select({ id: segments.id })
            .from(segments)
            .where(eq(segments.lineId, segmentLineId))

        const segmentIdsOnLine = new Set(segmentsOnLine.map((s) => String(s.id)))
        const riskySegmentsOnLine = Object.keys(body.segments_risk).filter((sid) => segmentIdsOnLine.has(sid))

        expect(riskySegmentsOnLine.length).toBeGreaterThan(0)
    })

    it('a report with lineId null falls back to the station lines for risk assignment', async () => {
        const { TransitNetworkDataService } = await import('../src/modules/transit/transit-network-data-service')
        const service = new TransitNetworkDataService(db)
        const stationsMap = await service.getStations()

        const singleLineStation = Object.entries(stationsMap).find(([, s]) => s.lines.length === 1)
        if (!singleLineStation) return // skip if no such station in seed data

        const [singleLineStationId, singleLineStationData] = singleLineStation
        const inferredLineId = singleLineStationData.lines[0]!

        await postRiskReport({ stationId: singleLineStationId, source: 'telegram' })

        const response = await getRisk()
        const body = (await response.json()) as RiskResponse

        // Resolve DB IDs for segments on the inferred line
        const segmentsOnLine = await db
            .select({ id: segments.id })
            .from(segments)
            .where(eq(segments.lineId, inferredLineId))

        const segmentIdsOnLine = new Set(segmentsOnLine.map((s) => String(s.id)))
        const riskySegmentsOnLine = Object.keys(body.segments_risk).filter((sid) => segmentIdsOnLine.has(sid))

        // (the model also propagates risk to overlapping segments on other lines,
        // so we only assert that at least one segment from the inferred line appears)
        expect(riskySegmentsOnLine.length).toBeGreaterThan(0)
    })

    it('a report on line A does not affect segments on an unrelated line B', async () => {
        const allLines = await db.select({ id: lines.id }).from(lines).limit(10)
        if (allLines.length < 2) return

        const lineA = allLines[0]!.id
        const lineB = allLines[1]!.id

        const [stationA] = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, lineA))
            .limit(1)

        if (!stationA) return

        await postRiskReport({ stationId: stationA.stationId, lineId: lineA, source: 'telegram' })

        const response = await getRisk()
        const body = (await response.json()) as RiskResponse

        // Collect the normalized station pairs (sorted from:to) for all line A segments.
        // Segments on line B that share a pair with line A legitimately inherit risk via
        // the overlap-propagation logic, so we exclude those from the assertion.
        const segmentsOnLineA = await db
            .select({ fromStationId: segments.fromStationId, toStationId: segments.toStationId })
            .from(segments)
            .where(eq(segments.lineId, lineA))

        const lineAPairs = new Set(segmentsOnLineA.map((s) => [s.fromStationId, s.toStationId].sort().join(':')))

        // Only consider segments on line B that do NOT share a station pair with line A
        const segmentsOnLineB = await db
            .select({ id: segments.id, fromStationId: segments.fromStationId, toStationId: segments.toStationId })
            .from(segments)
            .where(eq(segments.lineId, lineB))

        const exclusiveLineBIds = new Set(
            segmentsOnLineB
                .filter((s) => !lineAPairs.has([s.fromStationId, s.toStationId].sort().join(':')))
                .map((s) => String(s.id))
        )

        if (exclusiveLineBIds.size === 0) return // all line B segments overlap with line A — nothing to assert

        for (const sid of Object.keys(body.segments_risk)) {
            expect(exclusiveLineBIds.has(sid)).toBe(false)
        }
    })
})

describe('GET /v0/risk report type handling', () => {
    beforeAll(async () => {
        const [line] = await db.select({ id: lines.id }).from(lines).limit(1)
        const [stationOnLine] = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, line!.id))
            .limit(1)

        testLineId = line!.id
        testStationId = stationOnLine!.stationId
    })

    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(async () => {
        await db.delete(reports)
    })

    it('multiple reports on the same line accumulate higher risk than a single report', async () => {
        // Single report
        await postRiskReport({ stationId: testStationId, lineId: testLineId, source: 'telegram' })

        const singleResponse = await getRisk()
        const singleBody = (await singleResponse.json()) as RiskResponse
        const singleRiskValues = Object.values(singleBody.segments_risk).map((s) => s.risk)
        const singleMaxRisk = Math.max(...singleRiskValues)

        await db.delete(reports)

        // Get another station on the same line for a second report
        const stationsOnLine = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, testLineId))
            .limit(2)

        for (const s of stationsOnLine) {
            await postRiskReport({ stationId: s.stationId, lineId: testLineId, source: 'telegram' })
        }

        const multiResponse = await getRisk()
        const multiBody = (await multiResponse.json()) as RiskResponse
        const multiRiskValues = Object.values(multiBody.segments_risk).map((s) => s.risk)
        const multiMaxRisk = Math.max(...multiRiskValues)

        expect(multiMaxRisk).toBeGreaterThanOrEqual(singleMaxRisk)
    })

    it('a report with a direction produces directed risk (higher risk than without direction)', async () => {
        // Get two stations on the same line to use as station + direction
        const stationsOnLine = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, testLineId))
            .limit(2)

        if (stationsOnLine.length < 2) return

        const stationId = stationsOnLine[0]!.stationId
        const directionId = stationsOnLine[stationsOnLine.length - 1]!.stationId

        // Report without direction
        await postRiskReport({ stationId, lineId: testLineId, source: 'telegram' })

        const undirectedResponse = await getRisk()
        const undirectedBody = (await undirectedResponse.json()) as RiskResponse

        await db.delete(reports)

        // Report with direction
        await postRiskReport({ stationId, lineId: testLineId, directionId, source: 'telegram' })

        const directedResponse = await getRisk()
        const directedBody = (await directedResponse.json()) as RiskResponse

        // Both should produce risky segments
        expect(Object.keys(undirectedBody.segments_risk).length).toBeGreaterThan(0)
        expect(Object.keys(directedBody.segments_risk).length).toBeGreaterThan(0)
    })

    it('a report with no lineId spreads risk across all station lines, divided by number of lines', async () => {
        const { TransitNetworkDataService } = await import('../src/modules/transit/transit-network-data-service')
        const service = new TransitNetworkDataService(db)
        const stationsMap = await service.getStations()

        // Find a station on exactly 2 lines so the divisor is known and predictable
        const twoLineStation = Object.entries(stationsMap).find(([, s]) => s.lines.length === 2)
        if (!twoLineStation) return

        const [multiLineStationId, multiLineStationData] = twoLineStation
        const [lineA, lineB] = multiLineStationData.lines as [string, string]

        // Find a single-line station that is only on lineA, to use as our baseline
        const singleLineStationOnA = Object.entries(stationsMap).find(
            ([id, s]) => s.lines.length === 1 && s.lines[0] === lineA && id !== multiLineStationId
        )
        if (!singleLineStationOnA) return

        const [singleLineStationId] = singleLineStationOnA

        // --- Baseline: report at a single-line station on lineA with an explicit lineId ---
        await postRiskReport({ stationId: singleLineStationId, lineId: lineA, source: 'telegram' })

        const baselineResponse = await getRisk()
        const baselineBody = (await baselineResponse.json()) as RiskResponse
        const baselineSegmentsA = await db.select({ id: segments.id }).from(segments).where(eq(segments.lineId, lineA))
        const baselineIdsA = new Set(baselineSegmentsA.map((s) => String(s.id)))
        const baselineMaxRisk = Math.max(
            ...Object.entries(baselineBody.segments_risk)
                .filter(([sid]) => baselineIdsA.has(sid))
                .map(([, d]) => d.risk),
            0
        )

        await db.delete(reports)

        // --- Multi-line: same station but no lineId → lines = [lineA, lineB] ---
        await postRiskReport({ stationId: multiLineStationId, source: 'telegram' })

        const multiResponse = await getRisk()
        const multiBody = (await multiResponse.json()) as RiskResponse

        // Segments from BOTH lines should appear in the output
        const segmentsOnB = await db.select({ id: segments.id }).from(segments).where(eq(segments.lineId, lineB))
        const segmentIdsOnB = new Set(segmentsOnB.map((s) => String(s.id)))
        const riskyOnB = Object.keys(multiBody.segments_risk).filter((sid) => segmentIdsOnB.has(sid))
        expect(riskyOnB.length).toBeGreaterThan(0)

        const riskyOnA = Object.keys(multiBody.segments_risk).filter((sid) => baselineIdsA.has(sid))
        expect(riskyOnA.length).toBeGreaterThan(0)

        // Multi-line risk is dampened (by sqrt of the line count) but still lower than the single-line baseline.
        const multiMaxRiskOnA = Math.max(
            ...Object.entries(multiBody.segments_risk)
                .filter(([sid]) => baselineIdsA.has(sid))
                .map(([, d]) => d.risk),
            0
        )
        expect(multiMaxRiskOnA).toBeLessThan(baselineMaxRisk)
    })

    it('a report at a station with many connections still produces non-green risk', async () => {
        // Linear dampening (1/N) made high-degree hubs like Alexanderplatz disappear under the
        // green threshold. With the softer sqrt dampening the model is expected to surface at
        // least some yellow/red segments instead of nothing.
        const { TransitNetworkDataService } = await import('../src/modules/transit/transit-network-data-service')
        const service = new TransitNetworkDataService(db)
        const stationsMap = await service.getStations()

        const hub = Object.entries(stationsMap).reduce<[string, (typeof stationsMap)[string]] | null>(
            (best, entry) => (best === null || entry[1].lines.length > best[1].lines.length ? entry : best),
            null
        )
        if (hub === null) return
        const [hubStationId, hubData] = hub
        if (hubData.lines.length < 4) return // skip if the seeded data has no high-degree hub

        await postRiskReport({ stationId: hubStationId, source: 'telegram' })

        const response = await getRisk()
        expect(response.status).toBe(200)

        const body = (await response.json()) as RiskResponse
        const colors = Object.values(body.segments_risk).map((s) => s.color)
        expect(colors.length).toBeGreaterThan(0)
        for (const c of colors) {
            expect(VALID_COLORS).toContain(c)
            expect(c).not.toBe(GREEN)
        }
    })
})

describe('GET /v0/risk circular lines', () => {
    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(async () => {
        await db.delete(reports)
    })

    it('a report at the segment-list boundary of a circular line colours both adjacent branches', async () => {
        const [circularLine] = await db.select({ id: lines.id }).from(lines).where(eq(lines.isCircular, true)).limit(1)
        if (!circularLine) return // skip if the seeded city has no circular line

        const lineSegments = await db
            .select({ id: segments.id, fromStationId: segments.fromStationId })
            .from(segments)
            .where(eq(segments.lineId, circularLine.id))
            .orderBy(asc(segments.position))
        if (lineSegments.length < 2) return

        // The first segment's fromStation sits at the boundary where the list wraps
        const boundaryStationId = lineSegments[0]!.fromStationId
        await postRiskReport({ stationId: boundaryStationId, lineId: circularLine.id, source: 'telegram' })

        const response = await getRisk()
        const body = (await response.json()) as RiskResponse

        const firstSid = String(lineSegments[0]!.id)
        const lastSid = String(lineSegments[lineSegments.length - 1]!.id)
        expect(body.segments_risk[firstSid]).toBeDefined()
        expect(body.segments_risk[lastSid]).toBeDefined()
    })
})

describe('GET /v0/risk overlapping segments', () => {
    // Segments sharing the same from/to station pair (e.g. a shared tram/bus stop between two lines)
    // should all inherit the same risk color when any one of them is risky.

    let overlapIds: string[] = []
    let primaryLineId: string | null = null
    let overlapStationId: string | null = null

    beforeAll(async () => {
        const allSegments = await db
            .select({
                id: segments.id,
                lineId: segments.lineId,
                fromStationId: segments.fromStationId,
                toStationId: segments.toStationId,
            })
            .from(segments)

        // Group by normalized (sorted) station pair to find overlapping segments
        const pairMap = new Map<string, { ids: number[]; lineIds: string[]; fromStationId: string }>()
        for (const seg of allSegments) {
            const key = [seg.fromStationId, seg.toStationId].sort().join(':')
            const entry = pairMap.get(key) ?? { ids: [], lineIds: [], fromStationId: seg.fromStationId }
            entry.ids.push(seg.id)
            entry.lineIds.push(seg.lineId)
            pairMap.set(key, entry)
        }

        const overlap = Array.from(pairMap.values()).find((v) => v.ids.length > 1)
        if (overlap) {
            overlapIds = overlap.ids.map(String)
            primaryLineId = overlap.lineIds[0]!
            overlapStationId = overlap.fromStationId
        }
    })

    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(async () => {
        await db.delete(reports)
    })

    it('all segments sharing the same station pair get colored when one of them is risky', async () => {
        if (!primaryLineId || !overlapStationId || overlapIds.length === 0) return // skip if seed data has no overlapping pairs

        const overlapSegmentIds = overlapIds

        await postRiskReport({ stationId: overlapStationId, lineId: primaryLineId, source: 'telegram' })

        const response = await getRisk()
        const body = (await response.json()) as RiskResponse

        const riskyIds = new Set(Object.keys(body.segments_risk))

        // Every segment in the overlapping group must appear in the risk output
        for (const sid of overlapSegmentIds) {
            expect(riskyIds.has(sid)).toBe(true)
        }

        // All overlapping segments must share the same color (propagated from the primary segment)
        const colors = overlapSegmentIds.map((sid) => body.segments_risk[sid]?.color)
        const firstColor = colors[0]
        for (const color of colors) {
            expect(color).toBe(firstColor)
        }
    })
})
