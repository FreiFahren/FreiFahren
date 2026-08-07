import { fetchMock } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { TURNSTILE_ACTION, TURNSTILE_TOKEN_HEADER } from '../src/modules/reports/turnstile'
import { db, lineStations, lines } from './test-db'
import { appRequestWithRedirect, resetTestEnv, setTestEnv, testEnv } from './test-utils'

const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com'
const SECRET = 'test-turnstile-secret'

let stationId: string

type Verification = {
    success: boolean
    action?: string
    errorCodes?: string[]
    statusCode?: number
    hostname?: string
    challengeTs?: string
}

let verification: Verification = { success: true, action: TURNSTILE_ACTION }
const siteverifyCalls: Array<Record<string, string>> = []

type TurnstileLogEntry = {
    outcome: string
    platform: string
    enforce: boolean
    widgetHostname?: string
    tokenAgeMs?: number
    errorCodes?: string[]
}

// The logger writes structured fields through console.{info,warn}, which is what Sentry Logs
// ingests — so asserting on the console call is asserting on what actually reaches the sink.
const consoleCalls: unknown[][] = []

const turnstileLogs = (): TurnstileLogEntry[] =>
    consoleCalls
        .filter(([message]) => message === 'Turnstile verification')
        .map(([, entry]) => entry as TurnstileLogEntry)

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
                    hostname: verification.hostname,
                    challenge_ts: verification.challengeTs,
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
    consoleCalls.length = 0
    for (const level of ['info', 'warn'] as const) {
        vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
            consoleCalls.push(args)
        })
    }
})

afterEach(() => {
    resetTestEnv()
    vi.restoreAllMocks()
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

    /*
     * A pass rate needs both halves of the ratio. These assert the denominator exists at all, which
     * is the part that goes missing when only refusals are logged.
     */
    describe('decision log', () => {
        // The suite default is 'error', which would drop the very lines under test.
        beforeEach(() => {
            setTestEnv({ LOG_LEVEL: 'info' })
        })

        it('records a pass, so the rate has a denominator', async () => {
            await postReport({ [TURNSTILE_TOKEN_HEADER]: 'a-valid-token' })

            expect(turnstileLogs()).toEqual([
                expect.objectContaining({ outcome: 'passed', platform: 'unknown', enforce: true }),
            ])
        })

        it('records a refusal with the reason, and no reason on a pass', async () => {
            verification = { success: false, errorCodes: ['timeout-or-duplicate'] }
            await postReport({ [TURNSTILE_TOKEN_HEADER]: 'a-spent-token' })

            const [refused] = turnstileLogs()
            expect(refused).toMatchObject({ outcome: 'refused', errorCodes: ['timeout-or-duplicate'] })

            consoleCalls.length = 0
            verification = { success: true, action: TURNSTILE_ACTION }
            await postReport({ [TURNSTILE_TOKEN_HEADER]: 'a-valid-token' })

            expect(turnstileLogs().at(-1)).not.toHaveProperty('errorCodes')
        })

        it('attributes the decision to the platform that sent it', async () => {
            await postReport({ [TURNSTILE_TOKEN_HEADER]: 'a-valid-token', 'ff-platform': 'ios' })

            expect(turnstileLogs()[0]).toMatchObject({ platform: 'ios' })
        })

        it('records the hostname the widget was rendered on, as Cloudflare reports it', async () => {
            verification = { success: true, action: TURNSTILE_ACTION, hostname: 'localhost' }

            await postReport({ [TURNSTILE_TOKEN_HEADER]: 'a-valid-token' })

            expect(turnstileLogs()[0]).toMatchObject({ widgetHostname: 'localhost' })
        })

        it('records how long the token was held between solve and submit', async () => {
            verification = {
                success: true,
                action: TURNSTILE_ACTION,
                challengeTs: new Date(Date.now() - 5_000).toISOString(),
            }

            await postReport({ [TURNSTILE_TOKEN_HEADER]: 'a-valid-token' })

            const { tokenAgeMs } = turnstileLogs()[0]!
            expect(tokenAgeMs).toBeGreaterThanOrEqual(5_000)
            expect(tokenAgeMs).toBeLessThan(60_000)
        })

        it('omits the age rather than inventing one when the timestamp is unusable', async () => {
            verification = { success: true, action: TURNSTILE_ACTION, challengeTs: 'not-a-timestamp' }

            await postReport({ [TURNSTILE_TOKEN_HEADER]: 'a-valid-token' })

            expect(turnstileLogs()[0]!.tokenAgeMs).toBeUndefined()
        })

        it('records a tokenless attempt, which never reaches Cloudflare', async () => {
            await postReport()

            expect(turnstileLogs()).toEqual([
                expect.objectContaining({ outcome: 'refused', errorCodes: ['missing-input-response'] }),
            ])
        })

        it('records what monitor mode let through', async () => {
            setTestEnv({ TURNSTILE_SECRET_KEY: SECRET, REPORTING_ENABLED: 'true', TURNSTILE_ENFORCE: 'false' })

            expect((await postReport()).status).toBe(200)
            expect(turnstileLogs()).toEqual([expect.objectContaining({ outcome: 'refused', enforce: false })])
        })
    })

    it('does not treat a wrong shared secret as the telegram relay', async () => {
        const response = await postReport({ 'X-Password': 'not-the-password' })

        expect(response.status).toBe(403)
        expect(siteverifyCalls).toHaveLength(0)
    })
})
