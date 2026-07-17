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
                miniflare: {
                    compatibilityDate: '2025-10-11',
                    bindings: {
                        BACKEND_URL: 'https://backend.test',
                        PUBLIC_APP_URL: 'https://app.example.test',
                        MISTRAL_MODEL: 'mistral-small-latest',
                        TELEGRAM_CHAT_CITIES: { '-1001': 'berlin', '-1002': 'leipzig' },
                        MISTRAL_API_KEY: 'test-mistral-key',
                        TELEGRAM_BOT_TOKEN: '1:fake',
                        REPORT_PASSWORD: 'password',
                        TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
                    },
                },
            },
        },
    },
})
