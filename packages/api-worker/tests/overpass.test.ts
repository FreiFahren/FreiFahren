import { LEIPZIG, isExcludedLineRef } from '@freifahren/cities'
import { describe, expect, it } from 'vitest'

import {
    buildRefRegex,
    findMissingRouteRefs,
    inheritRouteMasterTags,
    type OsmElement,
} from '../src/db/seed/stations/overpass'

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

describe('inheritRouteMasterTags', () => {
    it('fills route and operator from the route_master and drops the master', () => {
        // Karlsruhe's tram 8 carries route=tram only on its route_master, Frankfurt's
        // tram 11 carries its operator only there.
        const child: OsmElement = { type: 'relation', id: 1, tags: { type: 'route', ref: '8' }, members: [] }
        const master: OsmElement = {
            type: 'relation',
            id: 2,
            tags: { type: 'route_master', route_master: 'tram', operator: 'VGF', ref: '8' },
            members: [{ type: 'relation', ref: 1, role: '' }],
        }
        const out = inheritRouteMasterTags([child, master])
        expect(out).toHaveLength(1)
        expect(out[0].tags).toMatchObject({ route: 'tram', operator: 'VGF' })
    })

    it('keeps tags the route already has', () => {
        const child: OsmElement = {
            type: 'relation',
            id: 1,
            tags: { type: 'route', route: 'light_rail', operator: 'AVG', ref: 'S8' },
            members: [],
        }
        const master: OsmElement = {
            type: 'relation',
            id: 2,
            tags: { type: 'route_master', route_master: 'train', operator: 'KVV', ref: 'S8' },
            members: [{ type: 'relation', ref: 1, role: '' }],
        }
        expect(inheritRouteMasterTags([child, master])[0].tags).toMatchObject({ route: 'light_rail', operator: 'AVG' })
    })
})
