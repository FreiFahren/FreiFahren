import { withSentry, instrumentDurableObjectWithSentry } from '@sentry/cloudflare'
import type { Env } from './types'
import { handleWebhook } from './webhook'
import { sentryOptions } from './observability'
import { TelegramNotifications } from './notifications'
import { CityDelivery as CityDeliveryObject } from './city-delivery'

// withSentry wraps the handler: unhandled errors in fetch are captured automatically,
// console.* is forwarded to Sentry Logs, and Sentry.captureException works inside
// ctx.waitUntil (the SDK binds the client via AsyncLocalStorage).
export default withSentry((env: Env) => sentryOptions(env), {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url)

        if (request.method === 'POST' && url.pathname === '/telegram/webhook') {
            return handleWebhook(request, env, ctx)
        }
        if (request.method === 'GET' && url.pathname === '/health') {
            return new Response('ok', { status: 200 })
        }

        return new Response('not found', { status: 404 })
    },
} satisfies ExportedHandler<Env>)

export const TelegramNotificationsEntrypoint = withSentry(sentryOptions, TelegramNotifications)

export const CityDelivery = instrumentDurableObjectWithSentry(
    (env: Cloudflare.Env) => sentryOptions(env),
    CityDeliveryObject
)
