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
 * Verify a token with Cloudflare. Deliberately does not check `hostname`: the native builds run in
 * a Capacitor WebView on `capacitor://localhost`, which is not a hostname a Turnstile widget can be
 * registered against, so enforcing it would reject every iOS and Android report. `action` is
 * checked instead — it is bound at widget render and gives the same anti-reuse property.
 */
export const verifyTurnstileToken = async (
    token: string,
    secret: string,
    remoteIp?: string
): Promise<{ ok: boolean; errorCodes: string[] }> => {
    const body = new URLSearchParams({ secret, response: token })
    if (remoteIp !== undefined && remoteIp !== '') body.set('remoteip', remoteIp)

    const response = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    })

    if (!response.ok) {
        return { ok: false, errorCodes: [`siteverify-http-${response.status}`] }
    }

    const result = (await response.json()) as SiteverifyResponse
    if (!result.success) {
        return { ok: false, errorCodes: result['error-codes'] ?? ['unknown'] }
    }

    // Older tokens predate action binding, so only reject a value that is present and wrong.
    if (result.action !== undefined && result.action !== '' && result.action !== TURNSTILE_ACTION) {
        return { ok: false, errorCodes: ['action-mismatch'] }
    }

    return { ok: true, errorCodes: [] }
}

const turnstileFailed = (errorCodes: string[]): AppError =>
    new AppError({
        message: 'Could not verify that this report came from the app',
        statusCode: 403,
        internalCode: 'TURNSTILE_FAILED',
        description: `Turnstile rejected the token: ${errorCodes.join(', ')}`,
    })

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
    next: Next
): Promise<void> => {
    c.get('logger').warn({ errorCodes, platform, enforce }, 'Turnstile verification failed')
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

    const { ok, errorCodes } = await verifyTurnstileToken(token, secret, c.req.header('CF-Connecting-IP'))
    if (!ok) {
        return reject(c, errorCodes, platform, enforce, next)
    }

    return next()
}
