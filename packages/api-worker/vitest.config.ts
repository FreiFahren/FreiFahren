import { fileURLToPath } from 'node:url'

import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig(async () => {
    const migrations = await readD1Migrations(fileURLToPath(new URL('drizzle', import.meta.url)))

    return {
        resolve: {
            alias: {
                '@freifahren/cities': new URL('../cities/src/index.ts', import.meta.url).pathname,
            },
        },
        test: {
            setupFiles: ['./tests/setup.ts'],
            poolOptions: {
                workers: {
                    // The reference tables are seeded once into a shared D1 instance; a single worker
                    // keeps that seed coherent across every suite. isolatedStorage is disabled so
                    // report rows persist across tests the way the original libsql suite relied on
                    // (suites that care about exact counts clear reports in before/afterEach), and so
                    // the one-time seed isn't rolled back between files.
                    singleWorker: true,
                    isolatedStorage: false,
                    miniflare: {
                        compatibilityDate: '2025-10-11',
                        // No `nodejs_compat` here even though production (wrangler.jsonc) sets it for
                        // @sentry/cloudflare: the flag swaps in workerd's real node:vm and breaks the
                        // vitest-pool-workers runner. The app under test (src/index.ts) has no Sentry
                        // and needs no node builtins, so omitting it is safe.
                        // DB_RECONCILE is a scratch database: with isolatedStorage off, a suite that
                        // rewrites whole tables would otherwise corrupt the shared seed for every
                        // other suite.
                        d1Databases: ['DB', 'DB_RECONCILE'],
                        bindings: {
                            TEST_MIGRATIONS: migrations,
                            CORS_ORIGINS:
                                'http://localhost,http://localhost:1871,http://127.0.0.1:1871,capacitor://localhost',
                            PREVIEW_WORKERS_SUBDOMAIN: 'freifahren',
                            NODE_ENV: 'development',
                            LOG_LEVEL: 'error',
                            STRIPE_WEBHOOK_SECRET: '',
                            POSTHOG_API_KEY: '',
                            POSTHOG_HOST: 'https://eu.i.posthog.com',
                        },
                    },
                },
            },
        },
    }
})
