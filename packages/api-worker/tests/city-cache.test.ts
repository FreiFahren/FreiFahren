import { fetchMock } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { purgeTransitCache } from '../src/db/seed/purge-transit-cache'
import { referenceCacheKey } from '../src/modules/transit/reference-cache'
import { transitCacheTag } from '../src/modules/transit/transit-cache-middleware'

describe('internal reference cache key is city-scoped', () => {
    it('namespaces the key under the city', () => {
        expect(referenceCacheKey('berlin', 'stations')).toContain('/berlin/stations')
    })

    it('gives two cities distinct keys', () => {
        expect(referenceCacheKey('berlin', 'stations')).not.toBe(referenceCacheKey('leipzig', 'stations'))
    })
})

describe('Cache-Tag is per city', () => {
    it('derives transit-network-<city>', () => {
        expect(transitCacheTag('berlin')).toBe('transit-network-berlin')
        expect(transitCacheTag('leipzig')).toBe('transit-network-leipzig')
    })

    it('keeps the tags distinct', () => {
        expect(transitCacheTag('berlin')).not.toBe(transitCacheTag('leipzig'))
    })
})

describe('cache.default purge is city-scoped', () => {
    beforeEach(() => {
        fetchMock.activate()
        fetchMock.disableNetConnect()
    })

    afterEach(() => {
        fetchMock.enableNetConnect()
        fetchMock.deactivate()
    })

    it("purges only the given city's tag, leaving the other city's entries intact", async () => {
        const purged: string[][] = []
        fetchMock
            .get('https://api.cloudflare.com')
            .intercept({ path: (p) => p.endsWith('/purge_cache'), method: 'POST' })
            .reply((opts) => {
                purged.push((JSON.parse(String(opts.body)) as { tags: string[] }).tags)
                return { statusCode: 200, data: { success: true } }
            })

        await purgeTransitCache('leipzig', { zoneId: 'test-zone', apiToken: 'test-token' })

        expect(purged).toEqual([['transit-network-leipzig']])
        // Berlin's tag is never in the payload, so purging Leipzig can't touch Berlin.
        expect(purged[0]).not.toContain(transitCacheTag('berlin'))
    })
})
