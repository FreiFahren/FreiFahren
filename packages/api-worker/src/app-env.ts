import { Context, Hono } from 'hono'

import { createLogger, Logger, LogLevel } from './common/logger'
import { createDb, DbConnection } from './db'
import { ReportsService } from './modules/reports'
import { RiskService } from './modules/risk'
import { TransitNetworkDataService } from './modules/transit/transit-network-data-service'

export type Bindings = {
    // Hyperdrive connection string; takes precedence over DATABASE_URL when present.
    HYPERDRIVE?: { connectionString: string }
    DATABASE_URL?: string
    CORS_ORIGINS?: string
    NODE_ENV?: string
    TELEGRAM_WORKER_URL?: string
    REPORT_PASSWORD?: string
    SENTRY_DSN?: string
    LOG_LEVEL?: LogLevel
}

export type AppConfig = {
    nodeEnv: string
    corsOrigins: string[]
    telegramWorkerUrl?: string
    reportPassword?: string
}

export type Services = {
    reportsService: ReportsService
    riskService: RiskService
    transitNetworkDataService: TransitNetworkDataService
}

export type Env = {
    Bindings: Bindings
    Variables: Services & {
        logger: Logger
        config: AppConfig
    }
}

export const resolveConfig = (env: Bindings): AppConfig => {
    const corsOrigins = (env.CORS_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin !== '')

    if (corsOrigins.length === 0) {
        throw new Error('CORS_ORIGINS must be set to a comma-separated list of allowed origins')
    }

    // Default to development so outbound Telegram notifications and verbose error descriptions
    // Only kick in when NODE_ENV=production is set explicitly.
    return {
        nodeEnv: env.NODE_ENV ?? 'development',
        corsOrigins,
        telegramWorkerUrl: env.TELEGRAM_WORKER_URL,
        reportPassword: env.REPORT_PASSWORD,
    }
}

const resolveConnectionString = (env: Bindings): string => {
    const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL
    if (connectionString === undefined || connectionString === '') {
        throw new Error('No database connection: set the HYPERDRIVE binding (Workers) or DATABASE_URL (Bun/Node)')
    }
    return connectionString
}

const applyServices = (c: Context<Env>, db: DbConnection, config: AppConfig) => {
    const transitNetworkDataService = new TransitNetworkDataService(db)
    const reportsService = new ReportsService(db, transitNetworkDataService, {
        nodeEnv: config.nodeEnv,
        telegramWorkerUrl: config.telegramWorkerUrl,
        reportPassword: config.reportPassword,
    })

    c.set('config', config)
    c.set('reportsService', reportsService)
    c.set('riskService', new RiskService(reportsService, transitNetworkDataService))
    c.set('transitNetworkDataService', transitNetworkDataService)
}

// Reused connection for non-Workers runtimes (tests, seed/CLI scripts), where there is no
// cross-request I/O restriction — opening one per request would exhaust the connection pool.
let nodeDb: { key: string; db: DbConnection } | null = null

const getNodeDb = (key: string): DbConnection => {
    if (!nodeDb || nodeDb.key !== key) {
        nodeDb = { key, db: createDb(key).db }
    }
    return nodeDb.db
}

export const registerContext = (app: Hono<Env>) => {
    app.use('*', async (c, next) => {
        // Set the logger first so the error handler can log even if resolveConfig below throws.
        c.set('logger', createLogger(c.env.LOG_LEVEL ?? 'info'))

        const config = resolveConfig(c.env)
        const key = resolveConnectionString(c.env)

        // The "no I/O across requests" limit is Workers-only. Off Workers (no execution context)
        // reuse one connection; on Workers a postgres.js client is bound to the request that opened
        // it, so build it per request and close it after the response (Hyperdrive pools upstream).
        let executionCtx: { waitUntil: (promise: Promise<unknown>) => void } | undefined
        try {
            executionCtx = c.executionCtx
        } catch {
            executionCtx = undefined
        }

        if (executionCtx === undefined) {
            applyServices(c, getNodeDb(key), config)
            await next()
            return
        }

        const { db, client } = createDb(key)
        applyServices(c, db, config)
        try {
            await next()
        } finally {
            executionCtx.waitUntil(client.end({ timeout: 5 }))
        }
    })
}
