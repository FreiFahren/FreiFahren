import { LEIPZIG, isExcludedLineRef } from '@freifahren/cities'
import { describe, expect, it } from 'vitest'

import { buildRefRegex, findMissingRouteRefs, type OsmElement } from '../src/db/seed/stations/overpass'

const routeRelation = (id: number, ref: string): OsmElement => ({
    type: 'relation',
    id,
    tags: { type: 'route', route: 'light_rail', ref },
    members: [],
})

describe('Leipzig excludeLineRefPatterns', () => {
    const patterns = LEIPZIG.seed.excludeLineRefPatterns

    it.each(['+65', '+65E', '+91', 'N1', 'N60', 'NXL', 'SEV 11', 'SEV 3E', 'Messe Transport', '108'])(
        'drops %s',
        (ref) => {
            expect(isExcludedLineRef(ref, patterns)).toBe(true)
        }
    )

    it.each(['1', '11E', '3E', '60', '60E', '65', '89', '90'])('keeps %s', (ref) => {
        expect(isExcludedLineRef(ref, patterns)).toBe(false)
    })
})

describe('buildRefRegex', () => {
    it('puts plus in a character class so Overpass ERE does not treat it as a quantifier', () => {
        expect(buildRefRegex(['+65', '+65E', '1'])).toBe('^([+]65|[+]65E|1)$')
    })
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
