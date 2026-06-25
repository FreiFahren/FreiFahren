import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
    test: {
        poolOptions: {
            workers: {
                miniflare: {
                    compatibilityDate: '2025-10-11',
                    bindings: {
                        BACKEND_URL: 'https://backend.test',
                        PUBLIC_APP_URL: 'https://app.example.test',
                        CITY_NAME: 'Berlin',
                        MISTRAL_MODEL: 'mistral-small-latest',
                        TELEGRAM_REPORT_CHAT_ID: '-1001',
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
