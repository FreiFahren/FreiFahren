import { transitFixture } from './test/transit-fixture'
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

// Vitest/Vite doesn't read tsconfig `paths`, so alias the shared registry here to match
// the tsconfig alias the rest of the toolchain (tsc, esbuild, bun) resolves on its own.
export default defineWorkersConfig({
    resolve: {
        alias: {
            '@freifahren/cities': new URL('../cities/src/index.ts', import.meta.url).pathname,
        },
    },
    test: {
        poolOptions: {
            workers: {
                main: './src/index.ts',
                miniflare: {
                    durableObjects: { CITY_DELIVERY: { className: 'CityDelivery', useSQLite: true } },
                    serviceBindings: { TRANSIT_API: 'transit-fixture' },
                    workers: [
                        {
                            name: 'transit-fixture',
                            modules: true,
                            script: transitFixture,
                            compatibilityDate: '2025-10-11',
                        },
                    ],
                    compatibilityDate: '2025-10-11',
                    bindings: {
                        NODE_ENV: 'production',
                        TELEGRAM_BOT_TOKEN: '1:test-secret',
                        SENTRY_DSN: '',
                        BACKEND_URL: 'https://backend.test',
                        MISTRAL_MODEL: 'mistral-small-latest',
                        MISTRAL_API_KEY: 'test-mistral-key',
                        TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
                    },
                },
            },
        },
    },
})
