import { asc } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'

import { predictSegmentRisk, type RiskModelReport, type RiskModelSegment } from '../src/modules/risk/risk-model'
import { db, lineStations } from './test-db'

/*
 * The loop must be long enough that the unwrapped distance from one end of
 * the segment list to the other decays to green — exactly the broken case a
 * wrapped distance has to repair.
 */
const LOOP_STATION_COUNT = 13

let lineId = ''
let loopStationIds: string[] = []

// Station ids come from whatever line the seeded city has that is long enough
// to build a loop from, so the test uses real ids without hard-coding a city.
beforeAll(async () => {
    const rows = await db
        .select({ lineId: lineStations.lineId, stationId: lineStations.stationId })
        .from(lineStations)
        .orderBy(asc(lineStations.lineId), asc(lineStations.order))

    const stationsByLine = new Map<string, string[]>()
    for (const row of rows) {
        const stationIds = stationsByLine.get(row.lineId) ?? []
        stationIds.push(row.stationId)
        stationsByLine.set(row.lineId, stationIds)
    }

    for (const [id, stationIds] of stationsByLine) {
        if (stationIds.length >= LOOP_STATION_COUNT) {
            lineId = id
            loopStationIds = stationIds.slice(0, LOOP_STATION_COUNT)
            break
        }
    }
})

const buildSegments = ({ closed }: { closed: boolean }): RiskModelSegment[] => {
    const arcCount = closed ? loopStationIds.length : loopStationIds.length - 1
    return Array.from({ length: arcCount }, (_, position) => ({
        sid: `seg-${position}`,
        lineId,
        fromStationId: loopStationIds[position]!,
        toStationId: loopStationIds[(position + 1) % loopStationIds.length]!,
    }))
}

const freshReportAt = (stationId: string, now: Date): RiskModelReport => ({
    stationId,
    lines: [lineId],
    directionId: null,
    timestamp: now,
})

describe('predictSegmentRisk circular lines', () => {
    const now = new Date('2026-01-01T12:00:00Z')

    it('propagates risk to both adjacent branches of a closed loop of segments', () => {
        if (loopStationIds.length === 0) return // skip if the seeded city has no line long enough

        const segments = buildSegments({ closed: true })
        const lastPosition = segments.length - 1

        const risk = predictSegmentRisk(segments, [freshReportAt(loopStationIds[0]!, now)], now)

        // Branch in segment-list order
        expect(risk['seg-0']).toBeDefined()
        expect(risk['seg-1']).toBeDefined()
        // Branch across the list boundary, where the first and last segments meet
        expect(risk[`seg-${lastPosition}`]).toBeDefined()
        expect(risk[`seg-${lastPosition - 1}`]).toBeDefined()
        expect(risk[`seg-${lastPosition}`]!.risk).toBeGreaterThan(0.2)

        // The wrap is a shortest path, not a blanket: the far side of the ring stays green
        const halfway = Math.floor(segments.length / 2)
        expect(risk[`seg-${halfway}`]).toBeUndefined()
    })

    it('wraps a flagged circular line whose seeded segment list is open by the closing arc', () => {
        if (loopStationIds.length === 0) return

        // Seeded rings drop the closing station repeat, so N stations yield N-1 segments
        const segments = buildSegments({ closed: false })
        const lastPosition = segments.length - 1

        const risk = predictSegmentRisk(segments, [freshReportAt(loopStationIds[0]!, now)], now, new Set([lineId]))

        expect(risk['seg-0']).toBeDefined()
        expect(risk[`seg-${lastPosition}`]).toBeDefined()
        expect(risk[`seg-${lastPosition}`]!.risk).toBeGreaterThan(0.2)
    })

    it('keeps linear-line behaviour unchanged: no wrap without a circular flag or closed loop', () => {
        if (loopStationIds.length === 0) return

        const segments = buildSegments({ closed: false })
        const lastPosition = segments.length - 1

        const risk = predictSegmentRisk(segments, [freshReportAt(loopStationIds[0]!, now)], now)

        expect(risk['seg-0']).toBeDefined()
        expect(risk[`seg-${lastPosition}`]).toBeUndefined()
    })

    it('keeps directional-report semantics on a circular line', () => {
        if (loopStationIds.length === 0) return

        const segments = buildSegments({ closed: true })
        const lastPosition = segments.length - 1

        const directed = predictSegmentRisk(
            segments,
            [{ ...freshReportAt(loopStationIds[0]!, now), directionId: loopStationIds[1]! }],
            now
        )
        const undirected = predictSegmentRisk(segments, [freshReportAt(loopStationIds[0]!, now)], now)

        // Directed reports still colour both sides of the loop
        expect(directed['seg-0']).toBeDefined()
        expect(directed[`seg-${lastPosition}`]).toBeDefined()
        // And stay distinguishable from undirected ones at the reported station
        expect(directed['seg-0']!.risk).not.toBe(undirected['seg-0']!.risk)
    })
})
