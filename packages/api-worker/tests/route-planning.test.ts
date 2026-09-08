import type { CityRoutingConfig, RouteType } from '@freifahren/cities'
import { describe, expect, it } from 'vitest'

import { NoPathFoundError, StationNotFoundError } from '../src/common/errors'
import { buildGraph, findRoute } from '../src/modules/transit/pathfinding'

const stations = [
    { id: 'A', name: 'A', lat: 52.5, lng: 13.4 },
    { id: 'B', name: 'B', lat: 52.51, lng: 13.41 },
]

const threeStations = [
    { id: 'A', name: 'A', lat: 52.5, lng: 13.4 },
    { id: 'B', name: 'B', lat: 52.51, lng: 13.41 },
    { id: 'C', name: 'C', lat: 52.52, lng: 13.42 },
]

const routing: CityRoutingConfig = {
    secondsPerHop: { subway: 100, light_rail: 120, tram: 90, bus: 95, train: 150 },
    transferSeconds: 240,
    maxSpeedMetersPerSecond: 22,
}

const line = (id: string, type: RouteType) => ({ id, isCircular: false, type })

describe('buildGraph', () => {
    it('carries the route type of each line', () => {
        const graph = buildGraph(
            stations,
            [{ id: 'L1', isCircular: false, type: 'tram' as const }],
            [
                { lineId: 'L1', stationId: 'A', order: 0 },
                { lineId: 'L1', stationId: 'B', order: 1 },
            ]
        )

        expect(graph.lineInfo.get('L1')?.type).toBe('tram')
    })
})

describe('findRoute', () => {
    it('returns one edge per hop along a single line', () => {
        const graph = buildGraph(
            threeStations,
            [line('L1', 'subway')],
            [
                { lineId: 'L1', stationId: 'A', order: 0 },
                { lineId: 'L1', stationId: 'B', order: 1 },
                { lineId: 'L1', stationId: 'C', order: 2 },
            ]
        )

        const edges = findRoute(graph, 'A', 'C', routing)

        expect(edges.map((edge) => [edge.fromStationId, edge.toStationId])).toEqual([
            ['A', 'B'],
            ['B', 'C'],
        ])
        expect(edges.map((edge) => edge.offsetSeconds)).toEqual([0, 100])
    })

    it('charges the transfer cost once when changing lines', () => {
        const graph = buildGraph(
            threeStations,
            [line('L1', 'subway'), line('L2', 'subway')],
            [
                { lineId: 'L1', stationId: 'A', order: 0 },
                { lineId: 'L1', stationId: 'B', order: 1 },
                { lineId: 'L2', stationId: 'B', order: 0 },
                { lineId: 'L2', stationId: 'C', order: 1 },
            ]
        )

        const edges = findRoute(graph, 'A', 'C', routing)

        expect(edges.map((edge) => edge.lineId)).toEqual(['L1', 'L2'])
        // Second edge starts after the first ride (100) plus one transfer (240).
        expect(edges[1].offsetSeconds).toBe(340)
    })

    it('prefers the slower-per-hop line when it avoids a transfer', () => {
        /*
         * The direct train costs 2 x 150 = 300; the subway pair costs 100 + 240 + 100.
         * The per-hop rates are deliberately the wrong way round: without the transfer
         * cost the subway pair would win at 200, so only the transfer can produce this
         * result. A cheaper-per-hop direct line would pass even with free transfers.
         */
        const graph = buildGraph(
            threeStations,
            [line('T1', 'train'), line('L1', 'subway'), line('L2', 'subway')],
            [
                { lineId: 'T1', stationId: 'A', order: 0 },
                { lineId: 'T1', stationId: 'B', order: 1 },
                { lineId: 'T1', stationId: 'C', order: 2 },
                { lineId: 'L1', stationId: 'A', order: 0 },
                { lineId: 'L1', stationId: 'B', order: 1 },
                { lineId: 'L2', stationId: 'B', order: 0 },
                { lineId: 'L2', stationId: 'C', order: 1 },
            ]
        )

        expect(findRoute(graph, 'A', 'C', routing).map((edge) => edge.lineId)).toEqual(['T1', 'T1'])
    })

    it('boarding at the origin costs no transfer', () => {
        const graph = buildGraph(
            stations,
            [line('L1', 'subway')],
            [
                { lineId: 'L1', stationId: 'A', order: 0 },
                { lineId: 'L1', stationId: 'B', order: 1 },
            ]
        )

        expect(findRoute(graph, 'A', 'B', routing)[0].offsetSeconds).toBe(0)
    })

    it('returns no edges when origin and destination are the same', () => {
        const graph = buildGraph(
            stations,
            [line('L1', 'subway')],
            [
                { lineId: 'L1', stationId: 'A', order: 0 },
                { lineId: 'L1', stationId: 'B', order: 1 },
            ]
        )

        expect(findRoute(graph, 'A', 'A', routing)).toEqual([])
    })

    it('throws when the target is unreachable', () => {
        const graph = buildGraph(
            [...stations, { id: 'X', name: 'X', lat: 52.6, lng: 13.5 }],
            [line('L1', 'subway')],
            [
                { lineId: 'L1', stationId: 'A', order: 0 },
                { lineId: 'L1', stationId: 'B', order: 1 },
            ]
        )

        expect(() => findRoute(graph, 'A', 'X', routing)).toThrow(NoPathFoundError)
    })

    it('throws when a station id is unknown', () => {
        const graph = buildGraph(
            stations,
            [line('L1', 'subway')],
            [
                { lineId: 'L1', stationId: 'A', order: 0 },
                { lineId: 'L1', stationId: 'B', order: 1 },
            ]
        )

        expect(() => findRoute(graph, 'A', 'NOPE', routing)).toThrow(StationNotFoundError)
    })
})
