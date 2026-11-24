import { describe, expect, it } from 'vitest'

import { canonicalStationName } from '../src/db/seed/config'
import { appRequestWithRedirect } from './test-utils'

describe('station names', () => {
    it('serves no station name that carries a mode marker', async () => {
        const response = await appRequestWithRedirect('/transit/stations')
        const stations: Record<string, { name: string }> = await response.json()
        const names = Object.values(stations).map((station) => station.name)

        expect(names.length).toBeGreaterThan(0)
        expect(names.filter((name) => /^(?:S\+U|U\+S|S|U) |\((?:S\+U|U\+S|S|U)\)$/u.test(name))).toEqual([])
        expect(names).toContain('Karlshorst')
    })

    it.each([
        ['S Karlshorst', 'Karlshorst'],
        ['U Gänsemarkt', 'Gänsemarkt'],
        ['S+U Rathaus Spandau', 'Rathaus Spandau'],
        ['U S Barmbek', 'Barmbek'],
        ['Kronenplatz (U)', 'Kronenplatz'],
        ['U Saarlandstraße (Süd)', 'Saarlandstraße (Süd)'],
    ])('drops the marker from %s', (osmName, expected) => {
        expect(canonicalStationName(osmName)).toBe(expected)
    })

    it.each(['Uhlandstraße', 'Bahnhof Mitte', 'Hauptbahnhof (Süd)', 'S', 'Schloss Strünkede'])(
        'leaves %s as it is',
        (osmName) => {
            expect(canonicalStationName(osmName)).toBe(osmName)
        }
    )
})
