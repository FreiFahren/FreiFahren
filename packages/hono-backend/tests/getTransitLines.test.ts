import { describe, expect, it } from 'bun:test'

import { appRequestWithRedirect } from './test-utils'

type LineResponse = {
    id: string
    name: string
    type: string
    isCircular: boolean
    color: string
    stations: string[]
}

type SegmentsResponse = {
    type: 'FeatureCollection'
    features: Array<{
        properties: { line: string; from: string; to: string; color: string }
    }>
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

const getLines = async (): Promise<LineResponse[]> => {
    const response = await appRequestWithRedirect('/v0/transit/lines')
    expect(response.status).toBe(200)
    return (await response.json()) as LineResponse[]
}

describe('GET /v0/transit/lines', () => {
    it('returns a stable hex color for every line', async () => {
        const lines = await getLines()
        expect(lines.length).toBeGreaterThan(0)
        for (const line of lines) {
            expect(line.color).toMatch(HEX_COLOR)
        }
    })

    it('applies the shared S-Bahn and tram colors from config', async () => {
        const lines = await getLines()
        const lightRail = lines.filter((line) => line.type === 'light_rail')
        const tram = lines.filter((line) => line.type === 'tram')
        expect(lightRail.length).toBeGreaterThan(0)
        expect(tram.length).toBeGreaterThan(0)
        expect(lightRail.every((line) => line.color === '#007734')).toBe(true)
        expect(tram.every((line) => line.color === '#be1414')).toBe(true)
    })
})

describe('GET /v0/transit/segments', () => {
    it('derives each segment color from its line color', async () => {
        const lines = await getLines()
        const colorByLineId = new Map(lines.map((line) => [line.id, line.color]))

        const response = await appRequestWithRedirect('/v0/transit/segments')
        expect(response.status).toBe(200)
        const segments = (await response.json()) as SegmentsResponse

        expect(segments.features.length).toBeGreaterThan(0)
        for (const feature of segments.features) {
            expect(feature.properties.color).toBe(colorByLineId.get(feature.properties.line)!)
        }
    })
})
