import { describe, expect, it } from 'bun:test'

import { app } from '../src'
import { testEnv } from './test-utils'

describe('per-request city resolution', () => {
    it('defaults to berlin when ?city is omitted', async () => {
        const response = await app.request('/v0/reports', undefined, testEnv())
        expect(response.status).toBe(200)
    })

    it('accepts an explicit, known ?city', async () => {
        const response = await app.request('/v0/reports?city=berlin', undefined, testEnv())
        expect(response.status).toBe(200)
    })

    it('rejects an unknown city with 400 UNKNOWN_CITY', async () => {
        const response = await app.request('/v0/reports?city=atlantis', undefined, testEnv())
        expect(response.status).toBe(400)
        const body = (await response.json()) as { details?: { internal_code?: string } }
        expect(body.details?.internal_code).toBe('UNKNOWN_CITY')
    })
})
