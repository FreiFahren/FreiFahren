/// <reference types="@cloudflare/workers-types" />
import { captureException, logger as sentryLogger, setTag, withSentry } from '@sentry/cloudflare'

import { Bindings, setErrorReporter, setScopeTagger } from './app-env'
import { setSentryLogSink } from './common/logger'
import { normalizeTransactionName } from './common/normalize-transaction-name'
import { TelegramReportsEntrypoint } from './modules/reports/telegram-reports-entrypoint'

import { app } from './index'

// Wired here, not in index.ts, so @sentry/cloudflare stays out of the test bundle.
// AsyncLocalStorage (set up by withSentry) keeps captures inside a request's waitUntil on its scope.
setErrorReporter((error, context) => captureException(error, context))

// Native Sentry logs preserve attributes as queryable fields; the console integration is not used because it serializes the second console argument into the message and would duplicate logs.
setSentryLogSink(sentryLogger)

// Same reason: let app-env tag the request scope (e.g. the resolved city) without importing the SDK.
setScopeTagger((key, value) => setTag(key, value))

// Cloudflare Worker entry. The Hono app lives in index.ts so tests can run it without the Sentry SDK.
export default withSentry(
    (env: Bindings) => ({
        dsn: env.SENTRY_DSN,
        release: env.SENTRY_RELEASE,
        environment: env.NODE_ENV,
        enableLogs: true,
        tracesSampleRate: 1.0,
        beforeSendTransaction: (event) => {
            if (event.transaction === undefined) return event
            const normalized = normalizeTransactionName(event.transaction)
            if (normalized !== event.transaction) {
                event.transaction = normalized
                // Mark it as a known route so Sentry treats it as a parameterized pattern.
                if (event.transaction_info) event.transaction_info.source = 'route'
            }
            return event
        },
    }),
    {
        fetch: (request, env, ctx) => {
            const rayId = request.headers.get('cf-ray')
            if (rayId !== null) setTag('cloudflare.ray_id', rayId)
            return app.fetch(request, env, ctx)
        },
    } satisfies ExportedHandler<Bindings>
)

export const TrustedTelegramReportsEntrypoint = withSentry(
    (env: Bindings) => ({
        dsn: env.SENTRY_DSN,
        release: env.SENTRY_RELEASE,
        environment: env.NODE_ENV,
        enableLogs: true,
        tracesSampleRate: 1.0,
    }),
    TelegramReportsEntrypoint
)
