import { describe, expect, it } from 'bun:test'

import { findMissingRouteRefs, type OsmElement } from '../src/db/seed/stations/overpass'

const routeRelation = (id: number, ref: string): OsmElement => ({
    type: 'relation',
    id,
    tags: { type: 'route', route: 'light_rail', ref },
    members: [],
})

describe('findMissingRouteRefs', () => {
    it('returns nothing when every discovered ref has a route relation', () => {
        const elements = [routeRelation(1, 'S15'), routeRelation(2, 'U4'), routeRelation(3, 'U4')]
        expect(findMissingRouteRefs(['S15', 'U4'], elements)).toEqual([])
    })

    it('reports refs whose route relation is missing from a truncated response', () => {
        // Mirrors the real partial-response bug: S15 and U4 were discovered but a
        // batch returned HTTP 200 with their relations dropped.
        const elements = [routeRelation(1, 'S1'), routeRelation(2, 'S2')]
        expect(findMissingRouteRefs(['S1', 'S2', 'S15', 'U4'], elements)).toEqual(['S15', 'U4'])
    })

    it('ignores non-route relations that happen to carry a matching ref', () => {
        const stopArea: OsmElement = {
            type: 'relation',
            id: 9,
            tags: { type: 'public_transport', public_transport: 'stop_area', ref: 'S15' },
            members: [],
        }
        expect(findMissingRouteRefs(['S15'], [stopArea])).toEqual(['S15'])
    })
})
