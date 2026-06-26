import { describe, expect, it } from 'vitest'
import {
    normalizeName,
    pickDirection,
    pickStation,
    resolveExtraction,
} from '../src/extractor'
import { makeIndex } from './fixtures'

const index = makeIndex()

describe('normalizeName', () => {
    it.each([
        ['Südkreuz', 'sudkreuz'],
        ['sudkreuz', 'sudkreuz'],
        ['  Südkreuz  ', 'sudkreuz'],
        ['S Südkreuz', 'sudkreuz'],
        ['U Turmstraße', 'turmstrasse'],
        ['Leinestr.', 'leinestrasse'],
        ['Leinestr', 'leinestrasse'],
    ])('normalizes %s -> %s', (raw, expected) => {
        expect(normalizeName(raw)).toBe(expected)
    })
})

describe('pickStation', () => {
    it('resolves a diacritic typo off-line', () => {
        expect(pickStation(index, 'sudkreuz', null)).toEqual(['S-suedkreuz', false])
    })

    it('flags an on-line match', () => {
        expect(pickStation(index, 'Rudow', 'U7')).toEqual(['U-rudow', true])
    })

    it('drops the line when the station is off it', () => {
        // 'u6 turmstr' — Turmstraße is on U9, so trust the station and drop the wrong line.
        expect(pickStation(index, 'turmstr', 'U6')).toEqual(['U-turmstrasse', false])
    })

    it('rejects a generic non-station word', () => {
        expect(pickStation(index, 'Bahnhof', null)).toBeNull()
    })

    it('returns null for an empty query', () => {
        expect(pickStation(index, null, null)).toBeNull()
        expect(pickStation(index, '', null)).toBeNull()
    })
})

describe('pickDirection', () => {
    it('restricts to the line', () => {
        expect(pickDirection(index, 'Rudow', 'U7')).toBe('U-rudow')
    })

    it('returns null for a missing query', () => {
        expect(pickDirection(index, null, 'U7')).toBeNull()
    })
})

describe('resolveExtraction', () => {
    it('resolves station and direction', () => {
        const result = resolveExtraction(
            index,
            { stationName: 'Rathaus Neukölln', directionName: 'Rudow' },
            'U7',
        )
        expect(result.stationId).toBe('U-rathaus-neukoelln')
        expect(result.lineName).toBe('U7')
        expect(result.directionId).toBe('U-rudow')
    })

    it('drops the line for an off-line station', () => {
        const result = resolveExtraction(index, { stationName: 'Turmstraße', directionName: null }, 'U6')
        expect(result.stationId).toBe('U-turmstrasse')
        expect(result.lineName).toBeNull()
    })

    it('is empty when nothing matches', () => {
        const result = resolveExtraction(index, { stationName: null, directionName: null }, null)
        expect(result.stationId).toBeNull()
        expect(result.lineName).toBeNull()
        expect(result.directionId).toBeNull()
    })
})
