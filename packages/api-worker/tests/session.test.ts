import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { type Bindings, type Env, registerContext } from '../src/app-env'
import { handleError } from '../src/common/error-handler'
import type { SessionsService } from '../src/modules/auth/auth-contract'
import { requireSession } from '../src/modules/auth'

import { testEnv } from './test-utils'

const SESSION = {
    user: { id: 'user-1', email: 'rider@example.org' },
    session: { id: 'session-1', expiresAt: '2030-01-01T00:00:00.000Z' },
}

const fakeAuth = (): SessionsService & { getSession: ReturnType<typeof vi.fn> } => ({
    getSession: vi.fn(async ({ authorization }) => (authorization === 'Bearer valid' ? SESSION : null)),
})

// No route requires a session yet, so the helpers run behind a probe route on the real context and
// error handling.
const probe = (headers: Record<string, string>, bindings: Partial<Bindings>) => {
    const app = new Hono<Env>()
    registerContext(app)
    app.get('/probe', async (c) => c.json((await requireSession(c)).user))
    app.onError(handleError)
    return app.request('/probe', { headers }, { ...testEnv(), ...bindings })
}

const internalCode = async (response: Response) =>
    ((await response.json()) as { details?: { internal_code?: string } }).details?.internal_code

describe('requireSession', () => {
    it('returns the user for a valid bearer token', async () => {
        const response = await probe({ Authorization: 'Bearer valid' }, { AUTH: fakeAuth() })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual(SESSION.user)
    })

    it('answers 401 without a header, for an unknown token, and for an oversized header', async () => {
        const auth = fakeAuth()

        const missing = await probe({}, { AUTH: auth })
        const unknown = await probe({ Authorization: 'Bearer expired' }, { AUTH: auth })
        const oversized = await probe({ Authorization: 'x'.repeat(4097) }, { AUTH: auth })

        for (const response of [missing, unknown, oversized]) {
            expect(response.status).toBe(401)
            expect(await internalCode(response)).toBe('UNAUTHENTICATED')
        }
        expect(auth.getSession).toHaveBeenCalledTimes(1)
    })

    it('answers 503 when the auth service is not bound', async () => {
        const response = await probe({ Authorization: 'Bearer valid' }, { AUTH: undefined })

        expect(response.status).toBe(503)
        expect(await internalCode(response)).toBe('AUTH_UNAVAILABLE')
    })

    it('forwards a header of exactly the maximum length', async () => {
        const auth = fakeAuth()
        await probe({ Authorization: 'x'.repeat(4096) }, { AUTH: auth })

        expect(auth.getSession).toHaveBeenCalledOnce()
    })

    it('answers 503 when the auth service rejects', async () => {
        const response = await probe(
            { Authorization: 'Bearer valid' },
            { AUTH: { getSession: () => Promise.reject(new Error('Network connection lost')) } }
        )

        expect(response.status).toBe(503)
        expect(await internalCode(response)).toBe('AUTH_UNAVAILABLE')
    })

    it.each([
        ['an unexpected shape', { user: {} }],
        ['an invalid expiry', { ...SESSION, session: { ...SESSION.session, expiresAt: 'banana' } }],
        ['undefined', undefined],
    ])('answers 500 rather than trusting %s', async (_, result) => {
        const response = await probe(
            { Authorization: 'Bearer valid' },
            { AUTH: { getSession: async () => result as never } }
        )

        expect(response.status).toBe(500)
    })
})
