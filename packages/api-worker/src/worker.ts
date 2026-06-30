/// <reference types="@cloudflare/workers-types" />
import { consoleLoggingIntegration, withSentry } from '@sentry/cloudflare'

import { Bindings } from './app-env'

import { app } from './index'

// Cloudflare Worker entry. The Hono app lives in index.ts so tests can run it without the Sentry SDK.
export default withSentry(
    (env: Bindings) => ({
        dsn: env.SENTRY_DSN,
        release: env.SENTRY_RELEASE,
        environment: env.NODE_ENV,
        enableLogs: true,
        integrations: [consoleLoggingIntegration({ levels: ['info', 'warn', 'error'] })],
        tracesSampleRate: 1.0,
    }),
    {
        fetch: app.fetch,
    } satisfies ExportedHandler<Bindings>
)
