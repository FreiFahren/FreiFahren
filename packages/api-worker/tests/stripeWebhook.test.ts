import { fetchMock } from 'cloudflare:test'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../src/index'
import { resetTestEnv, setSystemTime, setTestEnv, testEnv } from './test-utils'

const POSTHOG_ORIGIN = 'https://eu.i.posthog.com'
const WEBHOOK_SECRET = 'whsec_test_secret'
const NOW = new Date('2026-08-25T16:00:00.000Z')

type CapturedCapture = { body: Record<string, unknown> }

const captures: CapturedCapture[] = []
let captureStatus = 200

const hmacHex = async (secret: string, payload: string): Promise<string> => {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
    const bytes = new Uint8Array(signature)
    let hex = ''
    for (const byte of bytes) {
        hex += byte.toString(16).padStart(2, '0')
    }
    return hex
}

const sign = async (body: string, timestamp = Math.floor(NOW.getTime() / 1000), secret = WEBHOOK_SECRET) =>
    `t=${timestamp},v1=${await hmacHex(secret, `${timestamp}.${body}`)}`

const paidSession = (overrides: Record<string, unknown> = {}) => ({
    id: 'evt_paid',
    type: 'checkout.session.completed',
    created: Math.floor(NOW.getTime() / 1000),
    data: {
        object: {
            id: 'cs_test_1',
            object: 'checkout.session',
            amount_total: 500,
            currency: 'eur',
            payment_status: 'paid',
            client_reference_id: 'ph_user_1',
            ...overrides,
        },
    },
})

const postWebhook = async (body: unknown, signature?: string) => {
    const payload = typeof body === 'string' ? body : JSON.stringify(body)
    return app.request(
        '/webhooks/stripe',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(signature === undefined ? {} : { 'Stripe-Signature': signature }),
            },
            body: payload,
        },
        testEnv()
    )
}

beforeAll(() => {
    setSystemTime(NOW)
    setTestEnv({
        STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
        POSTHOG_API_KEY: 'phc_test',
        POSTHOG_HOST: POSTHOG_ORIGIN,
    })
    fetchMock.activate()
    fetchMock.disableNetConnect()
    fetchMock
        .get(POSTHOG_ORIGIN)
        .intercept({ path: '/capture/', method: 'POST' })
        .reply((opts) => {
            captures.push({ body: JSON.parse(String(opts.body)) as Record<string, unknown> })
            return { statusCode: captureStatus, data: { status: 1 } }
        })
        .persist()
})

afterAll(() => {
    setSystemTime()
    resetTestEnv()
    fetchMock.enableNetConnect()
    fetchMock.deactivate()
})

beforeEach(() => {
    captures.length = 0
    captureStatus = 200
    setTestEnv({
        STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
        POSTHOG_API_KEY: 'phc_test',
        POSTHOG_HOST: POSTHOG_ORIGIN,
    })
})

describe('POST /webhooks/stripe', () => {
    it('returns 503 when the signing secret is unset', async () => {
        setTestEnv({ STRIPE_WEBHOOK_SECRET: '' })
        const body = paidSession()
        const response = await postWebhook(body, await sign(JSON.stringify(body)))
        expect(response.status).toBe(503)
        expect(captures).toEqual([])
    })

    it('returns 400 when the signature is missing', async () => {
        const response = await postWebhook(paidSession())
        expect(response.status).toBe(400)
        expect(captures).toEqual([])
    })

    it('returns 400 when the signature is wrong', async () => {
        const body = paidSession()
        const response = await postWebhook(body, await sign(JSON.stringify(body), undefined, 'whsec_other'))
        expect(response.status).toBe(400)
        expect(captures).toEqual([])
    })

    it('returns 400 when the timestamp is too old', async () => {
        const body = paidSession()
        const payload = JSON.stringify(body)
        const stale = Math.floor(NOW.getTime() / 1000) - 400
        const response = await postWebhook(body, await sign(payload, stale))
        expect(response.status).toBe(400)
        expect(captures).toEqual([])
    })

    it('acknowledges unrelated events without capturing', async () => {
        const body = { id: 'evt_other', type: 'customer.created', created: Math.floor(NOW.getTime() / 1000), data: {} }
        const response = await postWebhook(body, await sign(JSON.stringify(body)))
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ received: true })
        expect(captures).toEqual([])
    })

    it('acknowledges unpaid checkout completion without capturing', async () => {
        const body = paidSession({ payment_status: 'unpaid', client_reference_id: undefined })
        const response = await postWebhook(body, await sign(JSON.stringify(body)))
        expect(response.status).toBe(200)
        expect(captures).toEqual([])
    })

    it('captures contribute_paid with the PostHog distinct id from client_reference_id', async () => {
        const body = paidSession()
        const response = await postWebhook(body, await sign(JSON.stringify(body)))
        expect(response.status).toBe(200)
        expect(captures).toHaveLength(1)
        expect(captures[0]?.body).toMatchObject({
            api_key: 'phc_test',
            event: 'contribute_paid',
            distinct_id: 'ph_user_1',
            timestamp: NOW.toISOString(),
            properties: {
                $insert_id: 'evt_paid',
                $process_person_profile: true,
                amount: 500,
                currency: 'eur',
                stripe_session_id: 'cs_test_1',
                attributed: true,
            },
        })
    })

    it('captures contribute_paid with a stripe session fallback when client_reference_id is missing', async () => {
        const body = paidSession({ client_reference_id: undefined })
        const response = await postWebhook(body, await sign(JSON.stringify(body)))
        expect(response.status).toBe(200)
        expect(captures[0]?.body).toMatchObject({
            distinct_id: 'stripe:cs_test_1',
            properties: { attributed: false, $process_person_profile: false },
        })
    })

    it('captures checkout.session.async_payment_succeeded', async () => {
        const body = { ...paidSession(), type: 'checkout.session.async_payment_succeeded', id: 'evt_async' }
        const response = await postWebhook(body, await sign(JSON.stringify(body)))
        expect(response.status).toBe(200)
        expect(captures[0]?.body).toMatchObject({
            event: 'contribute_paid',
            properties: { $insert_id: 'evt_async' },
        })
    })

    it('returns 500 when PostHog capture fails so Stripe retries', async () => {
        captureStatus = 500
        const body = paidSession()
        const response = await postWebhook(body, await sign(JSON.stringify(body)))
        expect(response.status).toBe(500)
    })

    it('acknowledges a paid event when PostHog is not configured', async () => {
        setTestEnv({ POSTHOG_API_KEY: '' })
        const body = paidSession()
        const response = await postWebhook(body, await sign(JSON.stringify(body)))
        expect(response.status).toBe(200)
        expect(captures).toEqual([])
    })
})
