import { describe, expect, it } from 'vitest'

import { buildLinePattern, buildSystemPrompt, detectLineName, resolveExtraction } from '../src/extractor'
import { buildIndex } from '../src/transit'
import { berlinProfile } from './fixtures'

/**
 * Berlin seeds MetroBus (M11-M85) alongside the Metrotram lines (M1-M17), so the two
 * share an "M<digits>" shape. This index mirrors that overlap — the shared fixture is
 * rail-only and can't exercise it.
 */
const index = buildIndex(
    {
        'B-hermannplatz': { name: 'Hermannplatz' },
        'B-moritzplatz': { name: 'Moritzplatz' },
        'B-anhalter': { name: 'Anhalter Bahnhof' },
        'B-warschauer': { name: 'Warschauer Straße' },
    },
    [
        { id: 'M41-v', name: 'M41', stations: ['B-anhalter', 'B-hermannplatz'] },
        { id: 'M29-v', name: 'M29', stations: ['B-moritzplatz', 'B-hermannplatz'] },
        { id: 'M4-v', name: 'M4', stations: ['B-warschauer'] },
        { id: 'U8-v', name: 'U8', stations: ['B-hermannplatz', 'B-moritzplatz'] },
    ],
    berlinProfile,
)

const detect = (message: string): string | null =>
    detectLineName(message, index.lineNames, buildLinePattern(index.lineNames), index.circularLineNames, berlinProfile)

describe('detectLineName — MetroBus', () => {
    it.each([
        ['M41 hermannplatz 3 bos', 'M41'],
        ['M 41 richtung anhalter bahnhof', 'M41'],
        ['m29 bus moritzplatz', 'M29'],
        ['3 Bos Jacken M29 Anhalter Bahnhof Richtung Hermannplatz', 'M29'],
    ])('detects a bus line in %j', (message, expected) => {
        expect(detect(message)).toBe(expected)
    })

    // The longest-first alternation in buildLinePattern is what keeps tram M4 from
    // swallowing bus M41 — without it every M41 report would be attributed to the tram.
    it('prefers the longer bus ref over a tram ref that prefixes it', () => {
        expect(detect('M41 warschauer')).toBe('M41')
    })

    it('still detects the tram line it prefixes', () => {
        expect(detect('M4 warschauer str')).toBe('M4')
    })
})

describe('resolveExtraction — MetroBus', () => {
    it('keeps the bus line when the station is on it', () => {
        expect(
            resolveExtraction(index, { stationName: 'Anhalter Bahnhof', directionName: 'Hermannplatz' }, 'M41', berlinProfile),
        ).toEqual({ stationId: 'B-anhalter', lineName: 'M41', directionId: 'B-hermannplatz' })
    })

    it('drops the bus line when the station is not on it', () => {
        expect(resolveExtraction(index, { stationName: 'Warschauer Straße', directionName: null }, 'M41', berlinProfile)).toEqual(
            { stationId: 'B-warschauer', lineName: null, directionId: null },
        )
    })
})

describe('buildSystemPrompt', () => {
    it('lists the seeded bus lines as tracked', () => {
        expect(buildSystemPrompt(index, berlinProfile)).toContain('We track these lines: M29, M4, M41, U8.')
    })

    // The note used to name M19/M29/M41 as examples of untracked lines; now that they are
    // seeded it must not contradict the tracked list above it.
    it('does not describe a tracked line as untracked', () => {
        const prompt = buildSystemPrompt(index, berlinProfile)
        const note = berlinProfile.untrackedLinesNote
        expect(prompt).toContain(note)
        for (const lineName of index.lineNames) {
            expect(note).not.toContain(lineName)
        }
    })
})
