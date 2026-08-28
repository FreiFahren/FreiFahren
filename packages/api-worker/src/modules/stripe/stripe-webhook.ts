import type { Context } from 'hono'

import type { Env } from '../../app-env'
import type { Logger } from '../../common/logger'

import { verifyStripeSignature } from './stripe-signature'

const PAID_EVENT_TYPES = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded'])

type StripeEvent = {
    id?: unknown
    type?: unknown
    created?: unknown
    data?: { object?: Record<string, unknown> }
}

const asString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.length > 0 ? value : undefined

const asNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined

const capturePaid = async ({
    host,
    apiKey,
    distinctId,
    attributed,
    eventId,
    sessionId,
    amount,
    currency,
    timestamp,
    logger,
}: {
    host: string
    apiKey: string
    distinctId: string
    attributed: boolean
    eventId: string
    sessionId: string
    amount: number | undefined
    currency: string | undefined
    timestamp: Date
    logger: Logger
}): Promise<boolean> => {
    const response = await fetch(`${host.replace(/\/$/, '')}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            api_key: apiKey,
            event: 'contribute_paid',
            distinct_id: distinctId,
            timestamp: timestamp.toISOString(),
            properties: {
                $lib: 'api-worker',
                $insert_id: eventId,
                $process_person_profile: attributed,
                amount,
                currency,
                stripe_session_id: sessionId,
                attributed,
            },
        }),
    })

    if (!response.ok) {
        logger.error({ status: response.status, eventId }, 'PostHog capture failed')
        return false
    }
    return true
}

export const postStripeWebhook = async (c: Context<Env>) => {
    const logger = c.get('logger')
    const secret = c.env.STRIPE_WEBHOOK_SECRET
    if (secret === undefined || secret.length === 0) {
        logger.error('Stripe webhook secret is not configured')
        return c.json({ error: 'webhook_not_configured' }, 503)
    }

    const payload = await c.req.text()
    const valid = await verifyStripeSignature(payload, c.req.header('Stripe-Signature'), secret)
    if (!valid) {
        logger.warn('Stripe webhook signature rejected')
        return c.json({ error: 'invalid_signature' }, 400)
    }

    let event: StripeEvent
    try {
        event = JSON.parse(payload) as StripeEvent
    } catch {
        return c.json({ error: 'invalid_json' }, 400)
    }

    const eventType = asString(event.type)
    const eventId = asString(event.id)
    if (eventType === undefined || eventId === undefined) {
        return c.json({ error: 'invalid_event' }, 400)
    }

    if (!PAID_EVENT_TYPES.has(eventType)) {
        return c.json({ received: true })
    }

    const session = event.data?.object ?? {}
    if (eventType === 'checkout.session.completed' && session.payment_status === 'unpaid') {
        return c.json({ received: true })
    }

    const sessionId = asString(session.id)
    if (sessionId === undefined) {
        return c.json({ error: 'invalid_session' }, 400)
    }

    const clientReferenceId = asString(session.client_reference_id)
    const distinctId = clientReferenceId ?? `stripe:${sessionId}`
    const created = asNumber(event.created)
    const timestamp = created === undefined ? new Date() : new Date(created * 1000)

    const apiKey = c.env.POSTHOG_API_KEY
    if (apiKey === undefined || apiKey.length === 0) {
        logger.warn({ eventId, sessionId }, 'PostHog API key is not configured; skipping contribute_paid')
        return c.json({ received: true })
    }

    const captured = await capturePaid({
        host: c.env.POSTHOG_HOST ?? 'https://eu.i.posthog.com',
        apiKey,
        distinctId,
        attributed: clientReferenceId !== undefined,
        eventId,
        sessionId,
        amount: asNumber(session.amount_total),
        currency: asString(session.currency),
        timestamp,
        logger,
    })

    if (!captured) {
        return c.json({ error: 'capture_failed' }, 500)
    }

    logger.info({ eventId, sessionId, attributed: clientReferenceId !== undefined }, 'contribution paid')
    return c.json({ received: true })
}
