import { describe, expect, it } from 'vitest'

import { predictSegmentRisk, type RiskModelReport, type RiskModelSegment } from '../src/modules/risk/risk-model'

/*
 * Real station ids (Berlin Ringbahn) used as opaque identifiers — the model
 * itself is city-agnostic and these tests never touch city config or the DB.
 */
const RING_STATIONS = [
    'n29190907', // Gesundbrunnen
    'n2924245391', // Wedding
    'n29045594', // Westhafen
    'BBEU', // Beusselstraße
    'n4330752281', // Jungfernheide
    'BWES', // Westend
    'BMN', // Messe Nord/ZOB
    'BWKRR', // Westkreuz
    'BHAL', // Halensee
    'BHO', // Hohenzollerndamm
    'n3783145806', // Heidelberger Platz
    'n29046990', // Bundesplatz
    'n29497638', // Innsbrucker Platz
    'BSGV', // Schöneberg
    'BSKV', // Südkreuz
    'n29058343', // Tempelhof
    'n31048718', // Hermannstraße
    'n3865616066', // Neukölln
    'BSO', // Sonnenallee
    'BTP', // Treptower Park
    'BOKS', // Ostkreuz
    'n710904931', // Frankfurter Allee
    'BSTO', // Storkower Straße
    'n98878581', // Landsberger Allee
    'n98878847', // Greifswalder Straße
    'n30305102', // Prenzlauer Allee
    'n91711807', // Schönhauser Allee
]

const LINE_ID = 'ring'
const REPORT_STATION = RING_STATIONS[0]!

const buildSegments = (stationIds: string[], { closed }: { closed: boolean }): RiskModelSegment[] => {
    const arcCount = closed ? stationIds.length : stationIds.length - 1
    return Array.from({ length: arcCount }, (_, position) => ({
        sid: `seg-${position}`,
        lineId: LINE_ID,
        fromStationId: stationIds[position]!,
        toStationId: stationIds[(position + 1) % stationIds.length]!,
    }))
}

const freshReportAt = (stationId: string, now: Date): RiskModelReport => ({
    stationId,
    lines: [LINE_ID],
    directionId: null,
    timestamp: now,
})

describe('predictSegmentRisk circular lines', () => {
    const now = new Date('2026-01-01T12:00:00Z')

    it('propagates risk to both adjacent branches of a closed loop of segments', () => {
        const segments = buildSegments(RING_STATIONS, { closed: true })
        const lastPosition = segments.length - 1

        const risk = predictSegmentRisk(segments, [freshReportAt(REPORT_STATION, now)], now)

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
        // Seeded rings drop the closing station repeat, so N stations yield N-1 segments
        const segments = buildSegments(RING_STATIONS, { closed: false })
        const lastPosition = segments.length - 1

        const risk = predictSegmentRisk(segments, [freshReportAt(REPORT_STATION, now)], now, new Set([LINE_ID]))

        expect(risk['seg-0']).toBeDefined()
        expect(risk[`seg-${lastPosition}`]).toBeDefined()
        expect(risk[`seg-${lastPosition}`]!.risk).toBeGreaterThan(0.2)
    })

    it('keeps linear-line behaviour unchanged: no wrap without a circular flag or closed loop', () => {
        const segments = buildSegments(RING_STATIONS, { closed: false })
        const lastPosition = segments.length - 1

        const risk = predictSegmentRisk(segments, [freshReportAt(REPORT_STATION, now)], now)

        expect(risk['seg-0']).toBeDefined()
        expect(risk[`seg-${lastPosition}`]).toBeUndefined()
    })

    it('keeps directional-report semantics on a circular line', () => {
        const segments = buildSegments(RING_STATIONS, { closed: true })
        const lastPosition = segments.length - 1

        const directed = predictSegmentRisk(
            segments,
            [{ ...freshReportAt(REPORT_STATION, now), directionId: RING_STATIONS[1]! }],
            now
        )
        const undirected = predictSegmentRisk(segments, [freshReportAt(REPORT_STATION, now)], now)

        // Directed reports still colour both sides of the loop
        expect(directed['seg-0']).toBeDefined()
        expect(directed[`seg-${lastPosition}`]).toBeDefined()
        // And stay distinguishable from undirected ones at the reported station
        expect(directed['seg-0']!.risk).not.toBe(undirected['seg-0']!.risk)
    })
})
