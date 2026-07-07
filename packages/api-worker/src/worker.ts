/// <reference types="@cloudflare/workers-types" />
import { captureException, consoleLoggingIntegration, setTag, withSentry } from '@sentry/cloudflare'

import { Bindings, setErrorReporter, setScopeTagger } from './app-env'
import { normalizeTransactionName } from './common/normalize-transaction-name'

import { app } from './index'

// Wired here, not in index.ts, so @sentry/cloudflare stays out of the test bundle.
// AsyncLocalStorage (set up by withSentry) keeps captures inside a request's waitUntil on its scope.
setErrorReporter((error, context) => captureException(error, context))

// Same reason: let app-env tag the request scope (e.g. the resolved city) without importing the SDK.
setScopeTagger((key, value) => setTag(key, value))

// Cloudflare Worker entry. The Hono app lives in index.ts so tests can run it without the Sentry SDK.
export default withSentry(
    (env: Bindings) => ({
        dsn: env.SENTRY_DSN,
        release: env.SENTRY_RELEASE,
        environment: env.NODE_ENV,
        enableLogs: true,
        integrations: [consoleLoggingIntegration({ levels: ['info', 'warn', 'error'] })],
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
        fetch: app.fetch,
    } satisfies ExportedHandler<Bindings>
)
