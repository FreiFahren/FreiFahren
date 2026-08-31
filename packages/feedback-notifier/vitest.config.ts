import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: '2026-08-31',
          bindings: {
            RESEND_API_KEY: 'test-resend-key',
            POSTHOG_WEBHOOK_SECRET: 'test-webhook-secret',
            RESEND_FROM: 'FreiFahren Feedback <feedback@freifahren.org>',
          },
        },
      },
    },
  },
})
