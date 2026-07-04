import { afterEach, describe, expect, it } from 'bun:test'

import { purgeTransitCache } from '../src/db/seed/purge-transit-cache'
import { referenceCacheKey } from '../src/modules/transit/reference-cache'
import { cityCacheKey, transitCacheTag } from '../src/modules/transit/transit-cache-middleware'

// The real Workers Cache API is absent under Bun (the middleware falls through) and only
// berlin is in the registry today, so we prove city-scoping at the key/tag derivation
// level: distinct cities -> distinct cache entries (distinct keys) and purge isolation
// (distinct tags, city-scoped purge). That is what keeps two cities from bleeding.
//
// TODO(vitest-cloudflare): once the suite runs on @cloudflare/vitest-pool-workers (or a
// getPlatformProxy-backed harness) there is a real caches.default, so replace these
// derivation-level checks with a true end-to-end integration test: drive GET
// /v0/transit/stations for two cities through transitEdgeCacheMiddleware, assert each
// stores its own entry and a second request is an X-Edge-Cache HIT, then purge one
// city's tag and assert that city misses while the other still hits. Needs a second
// city in the registry (or a test-only stub) to exercise the multi-city path fully.

describe('edge cache key is city-scoped', () => {
    const url = 'https://api.freifahren.org/v0/transit/stations'

    it('collapses the default (no param) and explicit ?city=berlin to one entry', () => {
        expect(cityCacheKey(url, 'berlin').url).toBe(cityCacheKey(`${url}?city=berlin`, 'berlin').url)
    })

    it('always carries the city in the key', () => {
        expect(cityCacheKey(url, 'berlin').url).toContain('city=berlin')
    })

    it('gives two cities distinct entries', () => {
        expect(cityCacheKey(url, 'berlin').url).not.toBe(cityCacheKey(url, 'leipzig').url)
    })
})

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

describe('purge is city-scoped', () => {
    const originalFetch = globalThis.fetch

    afterEach(() => {
        globalThis.fetch = originalFetch
        delete process.env.CLOUDFLARE_ZONE_ID
        delete process.env.CLOUDFLARE_API_TOKEN
    })

    it("purges only the given city's tag, leaving the other city's entries intact", async () => {
        process.env.CLOUDFLARE_ZONE_ID = 'test-zone'
        process.env.CLOUDFLARE_API_TOKEN = 'test-token'

        const purged: string[][] = []
        globalThis.fetch = (async (_url: string, init: RequestInit) => {
            purged.push((JSON.parse(init.body as string) as { tags: string[] }).tags)
            return new Response('{"success":true}', { status: 200 })
        }) as unknown as typeof fetch

        await purgeTransitCache('leipzig')

        expect(purged).toEqual([['transit-network-leipzig']])
        // Berlin's tag is never in the payload, so purging Leipzig can't touch Berlin.
        expect(purged[0]).not.toContain(transitCacheTag('berlin'))
    })
})
