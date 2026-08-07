import type { Context, MiddlewareHandler, Next } from 'hono'

import type { Env } from '../../app-env'
import { AppError } from '../../common/errors'

import { isTrustedWorkerCall } from './reports-disabled-middleware'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

// Cloudflare's widget posts the token under this name; the app forwards it as a header so the
// Report body stays exactly the shape the schema validates.
export const TURNSTILE_TOKEN_HEADER = 'cf-turnstile-response'

// Bound into the widget and checked here, so a token minted for some other widget on the site
// Cannot be redeemed against report submission.
export const TURNSTILE_ACTION = 'submit-report'

export type SiteverifyResponse = {
    success: boolean
    'error-codes'?: string[]
    action?: string
    hostname?: string
    challenge_ts?: string
}

/*
 * What Cloudflare told us about the token, kept for the decision log rather than for the verdict.
 *
 * `hostname` is where the widget that minted the token was rendered, so it separates the web build
 * from the native WebView at the point of redemption — the same split the request headers claim,
 * but attested by Cloudflare instead of asserted by the caller.
 *
 * `tokenAgeMs` is the gap between the challenge being solved and the report arriving. A person
 * solves and submits in one motion; a token that shows up long after it was minted was held
 * somewhere in between.
 */
export type SiteverifyMetadata = {
    hostname?: string
    tokenAgeMs?: number
}

const tokenAgeMs = (challengeTs: string | undefined, now: number): number | undefined => {
    if (challengeTs === undefined || challengeTs === '') return undefined
    const solvedAt = Date.parse(challengeTs)
    if (Number.isNaN(solvedAt)) return undefined
    // Clock skew between Cloudflare and the edge can make a fresh token look future-dated.
    return Math.max(0, now - solvedAt)
}

/*
 * Verify a token with Cloudflare. Deliberately does not check `hostname`: the native builds run in
 * a Capacitor WebView on `capacitor://localhost`, which is not a hostname a Turnstile widget can be
 * registered against, so enforcing it would reject every iOS and Android report. `action` is
 * checked instead — it is bound at widget render and gives the same anti-reuse property.
 */
export const verifyTurnstileToken = async (
    token: string,
    secret: string,
    remoteIp?: string
): Promise<{ ok: boolean; errorCodes: string[]; metadata: SiteverifyMetadata }> => {
    const body = new URLSearchParams({ secret, response: token })
    if (remoteIp !== undefined && remoteIp !== '') body.set('remoteip', remoteIp)

    const response = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    })

    if (!response.ok) {
        return { ok: false, errorCodes: [`siteverify-http-${response.status}`], metadata: {} }
    }

    const result = (await response.json()) as SiteverifyResponse
    const metadata: SiteverifyMetadata = {
        hostname: result.hostname,
        tokenAgeMs: tokenAgeMs(result.challenge_ts, Date.now()),
    }

    if (!result.success) {
        return { ok: false, errorCodes: result['error-codes'] ?? ['unknown'], metadata }
    }

    // Older tokens predate action binding, so only reject a value that is present and wrong.
    if (result.action !== undefined && result.action !== '' && result.action !== TURNSTILE_ACTION) {
        return { ok: false, errorCodes: ['action-mismatch'], metadata }
    }

    return { ok: true, errorCodes: [], metadata }
}

const turnstileFailed = (errorCodes: string[]): AppError =>
    new AppError({
        message: 'Could not verify that this report came from the app',
        statusCode: 403,
        internalCode: 'TURNSTILE_FAILED',
        description: `Turnstile rejected the token: ${errorCodes.join(', ')}`,
    })

/*
 * Every verdict is logged under one message, passes included, because the number that matters is a
 * rate and a rate needs its denominator. Logging only refusals answers "how many failed" and leaves
 * "out of how many" to be guessed from somewhere else — which is how a client that stopped sending
 * tokens at all could look, from here, like an ordinary quiet afternoon.
 *
 * `outcome` is the field to group by: 'passed' against everything else. Sentry Logs is the only
 * sink, so these are structured fields rather than an interpolated sentence.
 */
type TurnstileOutcome = 'passed' | 'refused'

/*
 * The network the request came from, as Cloudflare resolved it. Deliberately the network and not
 * the address: an ASN identifies a carrier, not a person, so it stays on the right side of the
 * privacy note at the top of common/logger.ts while still separating traffic by where it enters.
 *
 * Without it a refusal is anonymous, and refusals spread evenly across consumer carriers are
 * indistinguishable in the log from the same count arriving through one network — which are very
 * different situations. The organisation name rides along so a line is readable without a second
 * lookup.
 */
type RequestNetwork = { asn?: number; asOrganization?: string }

const requestNetwork = (c: Context<Env>): RequestNetwork => {
    // Absent off Cloudflare — the seed CLI and the test runner both call in without a cf object.
    const asn = c.req.raw.cf?.asn
    if (typeof asn !== 'number') return {}
    const asOrganization = c.req.raw.cf?.asOrganization
    return { asn, ...(typeof asOrganization === 'string' ? { asOrganization } : {}) }
}

const record = (
    c: Context<Env>,
    outcome: TurnstileOutcome,
    fields: { errorCodes: string[]; platform: string; enforce: boolean; metadata: SiteverifyMetadata }
): void => {
    const { errorCodes, platform, enforce, metadata } = fields
    const entry = {
        outcome,
        platform,
        enforce,
        widgetHostname: metadata.hostname,
        tokenAgeMs: metadata.tokenAgeMs,
        ...requestNetwork(c),
        ...(outcome === 'passed' ? {} : { errorCodes }),
    }
    const log = c.get('logger')
    if (outcome === 'passed') log.info(entry, 'Turnstile verification')
    else log.warn(entry, 'Turnstile verification')
}

/*
 * Monitor mode exists for one thing we cannot test: whether the native WebView can mint a token at
 * all. Enforcing straight away would surface that as users unable to report; monitoring surfaces it
 * as log lines instead, with the platform attached so the native share is measurable.
 *
 * It lets *everything* through while it is on, including traffic that has no token. That is the
 * point — and the reason it is meant for a short, watched window, not a resting state.
 */
const reject = async (
    c: Context<Env>,
    errorCodes: string[],
    platform: string,
    enforce: boolean,
    next: Next,
    metadata: SiteverifyMetadata = {}
): Promise<void> => {
    record(c, 'refused', { errorCodes, platform, enforce, metadata })
    if (enforce) throw turnstileFailed(errorCodes)
    return next()
}

/*
 * Requires a fresh, unredeemed Turnstile token on every report.
 *
 * This is the only control that costs an attacker something per *request* rather than per address.
 * Address rotation is free, which is why per-IP limits never bit; a token is single-use, so a flood
 * needs one solve per report.
 *
 * Inert until TURNSTILE_SECRET_KEY is set, so the deploy that introduces it changes nothing and the
 * app can start sending tokens first. Setting the secret before the clients send tokens would
 * reject every app report — deploy the frontend, then set the secret.
 */
export const turnstileMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    const secret = c.get('config').turnstileSecretKey
    if (secret === undefined || secret === '') return next()

    // Telegram relays server-to-server with no browser to solve a challenge; it authenticates with
    // The shared secret instead.
    if (isTrustedWorkerCall(c as Context<Env>)) return next()

    const enforce = c.get('config').turnstileEnforce
    const platform = c.req.header('ff-platform') ?? 'unknown'

    const token = c.req.header(TURNSTILE_TOKEN_HEADER)
    if (token === undefined || token === '') {
        return reject(c, ['missing-input-response'], platform, enforce, next)
    }

    const { ok, errorCodes, metadata } = await verifyTurnstileToken(token, secret, c.req.header('CF-Connecting-IP'))
    if (!ok) {
        return reject(c, errorCodes, platform, enforce, next, metadata)
    }

    record(c, 'passed', { errorCodes, platform, enforce, metadata })
    return next()
}
