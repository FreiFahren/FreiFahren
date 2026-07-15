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
                        d1Databases: ['DB'],
                        bindings: {
                            TEST_MIGRATIONS: migrations,
                            CORS_ORIGINS:
                                'http://localhost,http://localhost:1871,http://127.0.0.1:1871,capacitor://localhost',
                            PREVIEW_WORKERS_SUBDOMAIN: 'freifahren',
                            NODE_ENV: 'development',
                            REPORT_PASSWORD: 'password',
                            TELEGRAM_WORKER_URL: 'https://telegram-worker.test',
                            LOG_LEVEL: 'error',
                        },
                    },
                },
            },
        },
    }
})
