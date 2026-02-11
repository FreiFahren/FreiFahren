import { beforeAll, describe, expect, it } from 'bun:test'

import { seedBaseData } from '../src/db/seed/seed'
import { db } from '../src/db'
import app from '../src/index'

beforeAll(async () => {
    await seedBaseData(db)
})

describe('Versioning', () => {
    it('serves GET /v0/reports directly', async () => {
        const response = await app.request('/v0/reports')
        expect(response.status).toBe(200)
    })

    it('redirects GET /reports to /v0/reports with 307', async () => {
        const response = await app.request('/reports')
        expect(response.status).toBe(307)
        expect(new URL(response.headers.get('Location')!).pathname).toBe('/v0/reports')
    })

    it('redirects POST /reports to /v0/reports with 307', async () => {
        const response = await app.request('/reports', { method: 'POST' })
        expect(response.status).toBe(307)
        expect(new URL(response.headers.get('Location')!).pathname).toBe('/v0/reports')
    })

    it('preserves query params through redirects', async () => {
        const response = await app.request('/reports?from=2024-01-01T00:00:00Z&to=2024-01-02T00:00:00Z')
        expect(response.status).toBe(307)

        const location = new URL(response.headers.get('Location')!)
        expect(location.pathname).toBe('/v0/reports')
        expect(location.searchParams.get('from')).toBe('2024-01-01T00:00:00Z')
        expect(location.searchParams.get('to')).toBe('2024-01-02T00:00:00Z')
    })

    it('does not set deprecation headers on the latest version', async () => {
        const response = await app.request('/v0/reports')
        expect(response.status).toBe(200)
        expect(response.headers.get('Deprecation')).toBeNull()
        expect(response.headers.get('X-Latest-Api-Version')).toBeNull()
    })

    it('returns 404 with available versions for unknown version', async () => {
        const response = await app.request('/v99/reports')
        expect(response.status).toBe(404)

        const body = (await response.json()) as { error: string; availableVersions: string[] }
        expect(body.error).toBe('Version v99 not found for reports')
        expect(body.availableVersions).toContain('v0')
    })
})
