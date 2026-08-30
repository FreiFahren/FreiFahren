import type { D1Database } from '@cloudflare/workers-types'
import type { D1Migration } from '@cloudflare/vitest-pool-workers/config'

declare module 'cloudflare:test' {
    interface ProvidedEnv {
        DB: D1Database
        // Scratch database for tests that reconcile whole tables, so they never touch the shared seed.
        DB_RECONCILE: D1Database
        TEST_MIGRATIONS: D1Migration[]
        CORS_ORIGINS: string
        PREVIEW_WORKERS_SUBDOMAIN: string
        NODE_ENV: string
        LOG_LEVEL: string
        STRIPE_WEBHOOK_SECRET: string
        POSTHOG_API_KEY: string
        POSTHOG_HOST: string
    }
}
