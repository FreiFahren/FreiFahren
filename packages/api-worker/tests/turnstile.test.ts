import { fetchMock } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { TURNSTILE_ACTION, TURNSTILE_TOKEN_HEADER } from '../src/modules/reports/turnstile'
import { db, lineStations, lines } from './test-db'
import { appRequestWithRedirect, resetTestEnv, setTestEnv, testEnv } from './test-utils'

const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com'
const SECRET = 'test-turnstile-secret'

let stationId: string

type Verification = { success: boolean; action?: string; errorCodes?: string[]; statusCode?: number }

let verification: Verification = { success: true, action: TURNSTILE_ACTION }
const siteverifyCalls: Array<Record<string, string>> = []

const postReport = (headers: Record<string, string> = {}) =>
    appRequestWithRedirect('/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ stationId, source: 'web_app' }),
    })

beforeAll(async () => {
    const [line] = await db.select({ id: lines.id }).from(lines).limit(1)
    const [station] = await db
        .select({ id: lineStations.stationId })
        .from(lineStations)
        .where(eq(lineStations.lineId, line!.id))
        .limit(1)
    stationId = station!.id

    fetchMock.activate()
    fetchMock.disableNetConnect()
    fetchMock
        .get(TURNSTILE_ORIGIN)
        .intercept({ path: '/turnstile/v0/siteverify', method: 'POST' })
        .reply((options) => {
            siteverifyCalls.push(Object.fromEntries(new URLSearchParams(String(options.body))))
            return {
                statusCode: verification.statusCode ?? 200,
                data: {
                    success: verification.success,
                    action: verification.action,
                    'error-codes': verification.errorCodes ?? [],
                },
            }
        })
        .persist()
})

beforeEach(() => {
    siteverifyCalls.length = 0
    verification = { success: true, action: TURNSTILE_ACTION }
    setTestEnv({ TURNSTILE_SECRET_KEY: SECRET, REPORTING_ENABLED: 'true' })
})

afterEach(() => {
    resetTestEnv()
})

afterAll(() => {
    fetchMock.enableNetConnect()
    fetchMock.deactivate()
})

describe('Turnstile verification', () => {
    it('is inert while no secret is configured', async () => {
        setTestEnv({ TURNSTILE_SECRET_KEY: '', REPORTING_ENABLED: 'true' })

        expect((await postReport()).status).toBe(200)
        expect(siteverifyCalls).toHaveLength(0)
    })

    it('rejects a report with no token once a secret is configured', async () => {
        const response = await postReport()

        expect(response.status).toBe(403)
        expect((await response.json()) as { details: { internal_code: string } }).toMatchObject({
            details: { internal_code: 'TURNSTILE_FAILED' },
        })
        expect(siteverifyCalls).toHaveLength(0)
    })

    it('accepts a report whose token Cloudflare verifies', async () => {
        const response = await postReport({ [TURNSTILE_TOKEN_HEADER]: 'a-valid-token' })

        expect(response.status).toBe(200)
        expect(siteverifyCalls).toHaveLength(1)
        expect(siteverifyCalls[0]).toMatchObject({ secret: SECRET, response: 'a-valid-token' })
    })

    it('rejects a token Cloudflare refuses, and surfaces why', async () => {
        verification = { success: false, errorCodes: ['timeout-or-duplicate'] }

        const response = await postReport({ [TURNSTILE_TOKEN_HEADER]: 'a-spent-token' })

        expect(response.status).toBe(403)
        expect(siteverifyCalls).toHaveLength(1)
    })

    it('rejects a token minted for a different action', async () => {
        verification = { success: true, action: 'some-other-widget' }

        const response = await postReport({ [TURNSTILE_TOKEN_HEADER]: 'a-borrowed-token' })

        expect(response.status).toBe(403)
    })

    it('accepts a token whose action is absent', async () => {
        verification = { success: true }

        expect((await postReport({ [TURNSTILE_TOKEN_HEADER]: 'no-action-token' })).status).toBe(200)
    })

    it('fails closed when siteverify itself errors', async () => {
        // A malformed secret makes Cloudflare answer 400 rather than a success:false body.
        verification = { success: true, statusCode: 400 }

        const response = await postReport({ [TURNSTILE_TOKEN_HEADER]: 'a-valid-token' })

        expect(response.status).toBe(403)
    })

    it('lets the telegram relay through on the shared secret, without a token', async () => {
        const response = await postReport({ 'X-Password': testEnv().REPORT_PASSWORD ?? '' })

        expect(response.status).toBe(200)
        expect(siteverifyCalls).toHaveLength(0)
    })

    it('does not spend a token while the killswitch is on', async () => {
        setTestEnv({ TURNSTILE_SECRET_KEY: SECRET, REPORTING_ENABLED: '' })

        const response = await postReport({ [TURNSTILE_TOKEN_HEADER]: 'a-valid-token' })

        expect(response.status).toBe(503)
        expect(siteverifyCalls).toHaveLength(0)
    })

    it('monitor mode lets a refused token through, and still records it', async () => {
        setTestEnv({ TURNSTILE_SECRET_KEY: SECRET, REPORTING_ENABLED: 'true', TURNSTILE_ENFORCE: 'false' })
        verification = { success: false, errorCodes: ['invalid-input-response'] }

        const response = await postReport({ [TURNSTILE_TOKEN_HEADER]: 'a-rejected-token' })

        expect(response.status).toBe(200)
        expect(siteverifyCalls).toHaveLength(1)
    })

    it('monitor mode also lets a tokenless report through', async () => {
        setTestEnv({ TURNSTILE_SECRET_KEY: SECRET, REPORTING_ENABLED: 'true', TURNSTILE_ENFORCE: 'false' })

        expect((await postReport()).status).toBe(200)
    })

    it('enforces by default when TURNSTILE_ENFORCE is unset', async () => {
        setTestEnv({ TURNSTILE_SECRET_KEY: SECRET, REPORTING_ENABLED: 'true', TURNSTILE_ENFORCE: '' })

        expect((await postReport()).status).toBe(403)
    })

    it('does not treat a wrong shared secret as the telegram relay', async () => {
        const response = await postReport({ 'X-Password': 'not-the-password' })

        expect(response.status).toBe(403)
        expect(siteverifyCalls).toHaveLength(0)
    })
})
