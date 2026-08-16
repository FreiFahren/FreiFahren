import { describe, expect, it } from 'vitest'

import { buildLineVariants } from '../src/db/seed/lines/build-variants'
import type { OsmRelation } from '../src/db/seed/stations/overpass'

// The suite runs with the default seed city (Berlin), whose profile scopes bus to
// MetroBus (`^M\d+$`) via routeRefPatterns and leaves every other route type
// unscoped. Berlin sets no excludeLineRefPatterns, so the blacklist is inert here.
const nodeIdToStationId = new Map([
    [1, 'station-a'],
    [2, 'station-b'],
])

const routeRelation = (id: number, route: string, ref: string): OsmRelation => ({
    type: 'relation',
    id,
    tags: { type: 'route', route, ref },
    members: [
        { type: 'node', ref: 1, role: 'stop' },
        { type: 'node', ref: 2, role: 'stop' },
    ],
})

const refsOf = (relations: OsmRelation[]): string[] =>
    buildLineVariants(relations, nodeIdToStationId).map((variant) => variant.ref)

describe('buildLineVariants — route ref patterns', () => {
    it('keeps a bus ref matching the configured pattern', () => {
        expect(refsOf([routeRelation(1, 'bus', 'M41')])).toEqual(['M41'])
    })

    it.each(['184', 'X11', 'N8', 'M41E'])('drops the out-of-scope bus ref %s', (ref) => {
        expect(refsOf([routeRelation(1, 'bus', ref)])).toEqual([])
    })

    // A ref shared across route types must be judged per type: Berlin's tram refs are
    // unscoped, so a numeric tram survives a pattern that only applies to bus.
    it('applies the pattern only to the route type it is configured for', () => {
        expect(refsOf([routeRelation(1, 'tram', '12'), routeRelation(2, 'bus', '12')])).toEqual(['12'])
    })

    it('keeps a tram whose ref happens to match the bus pattern', () => {
        expect(refsOf([routeRelation(1, 'tram', 'M10')])).toEqual(['M10'])
    })
})
