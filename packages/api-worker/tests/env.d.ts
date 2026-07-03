import type { D1Database } from '@cloudflare/workers-types'
import type { D1Migration } from '@cloudflare/vitest-pool-workers/config'

declare module 'cloudflare:test' {
    interface ProvidedEnv {
        DB: D1Database
        TEST_MIGRATIONS: D1Migration[]
        CORS_ORIGINS: string
        NODE_ENV: string
        REPORT_PASSWORD: string
        TELEGRAM_WORKER_URL: string
        LOG_LEVEL: string
    }
}
