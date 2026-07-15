import { describe, expect, it } from 'vitest'

import { app } from '../src/index'
import { appRequestWithRedirect, testEnv } from './test-utils'

describe('Versioning', () => {
    it('serves GET /v0/reports directly', async () => {
        const response = await app.request('/v0/reports', undefined, testEnv())
        expect(response.status).toBe(200)
    })

    it('redirects GET /reports to /v0/reports with 307', async () => {
        const response = await app.request('/reports', undefined, testEnv())
        expect(response.status).toBe(307)
        expect(new URL(response.headers.get('Location')!).pathname).toBe('/v0/reports')
    })

    it('redirects POST /reports to /v0/reports with 307', async () => {
        const response = await app.request('/reports', { method: 'POST' }, testEnv())
        expect(response.status).toBe(307)
        expect(new URL(response.headers.get('Location')!).pathname).toBe('/v0/reports')
    })

    it('preserves query params through redirects', async () => {
        const response = await app.request(
            '/reports?from=2024-01-01T00:00:00Z&to=2024-01-02T00:00:00Z',
            undefined,
            testEnv()
        )
        expect(response.status).toBe(307)

        const location = new URL(response.headers.get('Location')!)
        expect(location.pathname).toBe('/v0/reports')
        expect(location.searchParams.get('from')).toBe('2024-01-01T00:00:00Z')
        expect(location.searchParams.get('to')).toBe('2024-01-02T00:00:00Z')
    })

    it('does not set deprecation headers on the latest version', async () => {
        const response = await appRequestWithRedirect('/v0/reports')
        expect(response.status).toBe(200)
        expect(response.headers.get('Deprecation')).toBeNull()
        expect(response.headers.get('X-Latest-Api-Version')).toBeNull()
    })

    it('returns 404 with available versions for unknown version', async () => {
        const response = await appRequestWithRedirect('/v99/reports')
        expect(response.status).toBe(404)

        const body = (await response.json()) as { error: string; availableVersions: string[] }
        expect(body.error).toBe('Version v99 not found for reports')
        expect(body.availableVersions).toContain('v0')
    })

    it('does not return version error for valid version with unmatched method', async () => {
        const response = await appRequestWithRedirect('/v0/reports', { method: 'PUT' })
        expect(response.status).toBe(404)

        const body = await response.text()
        expect(body).not.toContain('availableVersions')
    })
})

describe('ETag 304 + CORS', () => {
    const ALLOWED_ORIGIN = 'http://localhost:1871'

    it('returns 304 with Access-Control-Allow-Origin when If-None-Match matches', async () => {
        const initial = await app.request(
            '/v0/transit/stations',
            {
                headers: { Origin: ALLOWED_ORIGIN },
            },
            testEnv()
        )
        expect(initial.status).toBe(200)
        expect(initial.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN)

        const etag = initial.headers.get('ETag')
        expect(etag).not.toBeNull()

        const revalidated = await app.request(
            '/v0/transit/stations',
            {
                headers: {
                    Origin: ALLOWED_ORIGIN,
                    'If-None-Match': etag!,
                },
            },
            testEnv()
        )

        expect(revalidated.status).toBe(304)
        // Without this header the browser blocks the cross-origin 304 and the
        // frontend's localStorage cache path fails — that is the regression we
        // are guarding against.
        expect(revalidated.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN)
        expect(revalidated.headers.get('ETag')).toBe(etag)
    })
})

describe('CORS', () => {
    const ALLOWED_ORIGIN = 'http://localhost:1871'
    const PREVIEW_ORIGIN = 'https://frontend-pr-744.freifahren.workers.dev'
    const DISALLOWED_ORIGIN = 'https://not-on-the-list.example'
    const MALFORMED_PREVIEW_ORIGIN = 'https://frontend-pr-not-a-number.freifahren.workers.dev'

    it('does not echo a disallowed origin', async () => {
        const response = await app.request(
            '/v0/transit/stations',
            { headers: { Origin: DISALLOWED_ORIGIN } },
            testEnv()
        )

        expect(response.status).toBe(200)
        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    it('grants a preflight from an allowed origin', async () => {
        const response = await appRequestWithRedirect('/reports', {
            method: 'OPTIONS',
            headers: {
                Origin: ALLOWED_ORIGIN,
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type',
            },
        })

        expect(response.status).toBe(204)
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN)
        expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
        expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type')
    })

    it('grants a preflight from a frontend preview origin', async () => {
        const response = await appRequestWithRedirect('/reports', {
            method: 'OPTIONS',
            headers: {
                Origin: PREVIEW_ORIGIN,
                'Access-Control-Request-Method': 'POST',
            },
        })

        expect(response.status).toBe(204)
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(PREVIEW_ORIGIN)
    })

    it.each([DISALLOWED_ORIGIN, MALFORMED_PREVIEW_ORIGIN])('does not grant a preflight from %s', async (origin) => {
        const response = await appRequestWithRedirect('/reports', {
            method: 'OPTIONS',
            headers: {
                Origin: origin,
                'Access-Control-Request-Method': 'POST',
            },
        })

        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })
})

describe('Transit cache headers', () => {
    it.each(['/transit/stations', '/transit/lines', '/transit/segments'])(
        'sets Workers Cache headers on %s',
        async (path) => {
            const response = await appRequestWithRedirect(path)

            expect(response.status).toBe(200)
            expect(response.headers.get('Cache-Control')).toContain('max-age=0')
            expect(response.headers.get('Cache-Control')).toContain('must-revalidate')
            expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('public, max-age=2592000')
            expect(response.headers.get('Vary')).toContain('Origin')
            expect(response.headers.get('Cache-Tag')).toBe('transit-network-berlin')
        }
    )

    it('does not make other transit endpoints eligible for Workers Cache', async () => {
        const response = await appRequestWithRedirect('/transit/distance?from=900000100001&to=900000100002')

        expect(response.status).toBe(404)
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        expect(response.headers.get('Cache-Tag')).toBeNull()
    })
})

describe('dynamic API cache headers', () => {
    it('keeps risk responses out of Workers Cache', async () => {
        const response = await app.request('/v0/risk', undefined, testEnv())

        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('no-store')
    })
})
