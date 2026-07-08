import { describe, expect, it } from 'vitest'

import { normalizeTransactionName } from '../src/common/normalize-transaction-name'

describe('normalizeTransactionName', () => {
    it.each([
        ['GET /v0/reports/BAHU', 'GET /v0/reports/:stationId'],
        ['GET /v0/reports/U-hermannplatz', 'GET /v0/reports/:stationId'],
        ['GET /v1/reports/BAHU', 'GET /v1/reports/:stationId'],
    ])('collapses the station segment: %s → %s', (input, expected) => {
        expect(normalizeTransactionName(input)).toBe(expected)
    })

    it.each([
        ['the list route', 'GET /v0/reports'],
        ['the list route with a trailing slash', 'GET /v0/reports/'],
        ['POST to the list route', 'POST /v0/reports'],
        ['other modules', 'GET /v0/transit/stations'],
        ['nested paths below a station', 'GET /v0/reports/BAHU/extra'],
        ['unversioned paths', 'GET /reports/BAHU'],
    ])('leaves %s untouched', (_label, input) => {
        expect(normalizeTransactionName(input)).toBe(input)
    })
})
