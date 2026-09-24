import { describe, expect, it, vi } from 'vitest'

import {
    ANNOUNCEMENTS_CACHE_CONTROL,
    ANNOUNCEMENTS_WORKERS_CACHE_CONTROL,
} from '../src/modules/announcements/announcements-cache-middleware'
import type { Announcement } from '../src/modules/announcements/announcements-types'

import { appRequestWithRedirect } from './test-utils'

// Fixtures replace the real announcements so the suite doesn't depend on which ones ship.
vi.mock('../src/modules/announcements/announcements', () => {
    const announcement = (id: string, publishedAt: string, extra: Partial<Announcement> = {}): Announcement => ({
        id,
        publishedAt,
        en: { title: `${id} en`, description: 'd', bodyHtml: `<p>${id}</p>` },
        de: { title: `${id} de`, description: 'd' },
        ...extra,
    })
    // Deliberately out of order: the service sorts newest first.
    const ANNOUNCEMENTS: Announcement[] = [
        announcement('a', '2026-01-01T00:00:00Z'),
        announcement('c', '2026-03-01T00:00:00Z'),
        announcement('hamburg-only', '2026-02-15T00:00:00Z', { cities: ['hamburg'] }),
        announcement('b', '2026-02-01T00:00:00+01:00', { en: { title: 'b en', description: 'd' }, de: undefined }),
    ]
    return { ANNOUNCEMENTS }
})

type ListResponse = { id: string; title: string; hasBody: boolean }[]

const list = async (query: string) => {
    const response = await appRequestWithRedirect(`/announcements?${query}`)
    expect(response.status).toBe(200)
    return (await response.json()) as ListResponse
}

describe('GET /v0/announcements', () => {
    it('lists announcements visible in the city, newest first', async () => {
        const items = await list('')
        expect(items.map((item) => item.id)).toEqual(['c', 'b', 'a'])
        expect(items.map((item) => item.hasBody)).toEqual([true, false, true])
    })

    it('is revalidated with a 304 while unchanged', async () => {
        const first = await appRequestWithRedirect('/announcements?lang=en')
        expect(first.headers.get('Cache-Control')).toBe(ANNOUNCEMENTS_CACHE_CONTROL)
        expect(first.headers.get('Cloudflare-CDN-Cache-Control')).toBe(ANNOUNCEMENTS_WORKERS_CACHE_CONTROL)
        const etag = first.headers.get('ETag')
        expect(etag).not.toBeNull()

        const revalidated = await appRequestWithRedirect('/announcements?lang=en', {
            headers: { 'If-None-Match': etag! },
        })
        expect(revalidated.status).toBe(304)
        expect(revalidated.headers.get('Cache-Control')).toBe(ANNOUNCEMENTS_CACHE_CONTROL)
    })

    it('limits city-scoped announcements to their cities', async () => {
        const items = await list('city=hamburg')
        expect(items.map((item) => item.id)).toEqual(['c', 'hamburg-only', 'b', 'a'])
    })

    it('falls back to English when a translation is missing', async () => {
        const items = await list('lang=de')
        expect(items.map((item) => item.title)).toEqual(['c de', 'b en', 'a de'])
    })
})

describe('GET /v0/announcements/:id', () => {
    it('returns the localized body', async () => {
        const response = await appRequestWithRedirect('/announcements/c?lang=en')
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({ id: 'c', title: 'c en', bodyHtml: '<p>c</p>' })
    })

    it('returns a null body for an announcement without one', async () => {
        const response = await appRequestWithRedirect('/announcements/b')
        expect(await response.json()).toMatchObject({ id: 'b', bodyHtml: null })
    })

    it('returns 404 for an unknown id or one scoped to another city', async () => {
        expect((await appRequestWithRedirect('/announcements/does-not-exist')).status).toBe(404)
        expect((await appRequestWithRedirect('/announcements/hamburg-only?city=berlin')).status).toBe(404)
    })
})
