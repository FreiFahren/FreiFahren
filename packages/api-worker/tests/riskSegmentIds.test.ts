import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../src'
import { segmentId } from '../src/db/seed/segments'

import { db, lineStations, lines, segments } from './test-db'
import { appRequestWithRedirect, sendReportRequest } from './test-utils'

type RiskResponse = { segments_risk: Record<string, { color: string; risk: number }> }
type SegmentFeature = { properties: { id: number; line: string; from: string; to: string } }
type SegmentsResponse = { features: SegmentFeature[] }

let app = createApp()

beforeEach(() => {
    app = createApp()
})

const getJson = async <T>(path: string): Promise<T> => {
    const response = await appRequestWithRedirect(path, undefined, app)
    expect(response.status).toBe(200)
    return response.json() as Promise<T>
}

// The map joins the risk model's output onto the cached segments GeoJSON by id, in the client. If
// the two ever disagree, risk colours land on the wrong lines — silently, because an unmatched id
// just renders as no risk.
describe('risk keys and segment ids', () => {
    it('only reports risk for segments the map can draw', async () => {
        const [line] = await db.select({ id: lines.id }).from(lines).limit(1)
        const [station] = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, line.id))
            .limit(1)
        await sendReportRequest({ stationId: station.stationId, lineId: line.id, source: 'telegram' }, app)

        const [risk, collection] = await Promise.all([
            getJson<RiskResponse>('/risk'),
            getJson<SegmentsResponse>('/transit/segments'),
        ])

        const drawable = new Set(collection.features.map((feature) => String(feature.properties.id)))
        expect(Object.keys(risk.segments_risk).length).toBeGreaterThan(0)
        expect(Object.keys(risk.segments_risk).filter((id) => !drawable.has(id))).toEqual([])
    })

    it('serves the id derived from the station pair, so a cached client stays correct', async () => {
        const collection = await getJson<SegmentsResponse>('/transit/segments')

        for (const { properties } of collection.features.slice(0, 50)) {
            expect(properties.id).toBe(segmentId(properties.line, properties.from, properties.to))
        }
    })

    it('keeps ids unique across the network', async () => {
        const rows = await db.select({ id: segments.id }).from(segments)

        expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length)
    })

    it('addresses a segment by the same id its station pair always produces', async () => {
        const [row] = await db
            .select({
                id: segments.id,
                lineId: segments.lineId,
                from: segments.fromStationId,
                to: segments.toStationId,
            })
            .from(segments)
            .limit(1)
        const [found] = await db
            .select({ id: segments.id })
            .from(segments)
            .where(
                and(
                    eq(segments.lineId, row.lineId),
                    eq(segments.fromStationId, row.from),
                    eq(segments.toStationId, row.to)
                )
            )

        expect(found.id).toBe(segmentId(row.lineId, row.from, row.to))
    })
})
