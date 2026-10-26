import { describe, expect, it } from 'vitest'

import { buildLinePattern, buildLineTermini, detectLineName } from '../src/extractor'
import { buildIndex } from '../src/transit'
import { berlinProfile } from './fixtures'

// Bare tram numbers, as Hannover writes its Stadtbahn lines ("5 anderten").
const index = buildIndex(
    {
        'H-anderten': { name: 'Anderten' },
        'H-kroepcke': { name: 'Kröpcke' },
        'H-stoecken': { name: 'Stöcken' },
        'H-zoo': { name: 'Zoo' },
        'H-messe': { name: 'Messe/Ost (EXPO-Plaza)' },
    },
    [
        { id: '5-a', name: '5', stations: ['H-stoecken', 'H-kroepcke', 'H-anderten'] },
        { id: '11-a', name: '11', stations: ['H-kroepcke', 'H-zoo'] },
        { id: '6-a', name: '6', stations: ['H-kroepcke', 'H-messe'] },
    ],
    berlinProfile
)

const detect = (message: string): string | null =>
    detectLineName(
        message,
        index.lineNames,
        buildLinePattern(index.lineNames),
        index.circularLineNames,
        berlinProfile,
        buildLineTermini(index)
    )

describe('detectLineName — number before a terminus', () => {
    it.each([
        ['5 anderten vier Stück, jetzt kantplatz', '5'],
        ['3 kontros jetzt richtung 5 anderten', '5'],
        ['11 Zoo 2 glatzköpfe', '11'],
        ['fahren 6 messe Ost', '6'],
    ])('detects the line in %j', (message, expected) => {
        expect(detect(message)).toBe(expected)
    })

    it.each([
        // Kröpcke is on the 5 but not one of its termini, so this stays a count.
        ['5 kröpcke'],
        ['5 leute anderten'],
        // Anderten is the 5's terminus, not the 11's.
        ['11 anderten'],
    ])('leaves %j alone', (message) => {
        expect(detect(message)).toBeNull()
    })
})
