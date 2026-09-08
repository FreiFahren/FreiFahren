import { describe, expect, it } from 'vitest'

import { buildGraph } from '../src/modules/transit/pathfinding'

const stations = [
    { id: 'A', name: 'A', lat: 52.5, lng: 13.4 },
    { id: 'B', name: 'B', lat: 52.51, lng: 13.41 },
]

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
