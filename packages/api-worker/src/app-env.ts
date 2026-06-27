import { Hono } from 'hono'

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

const createServices = (db: DbConnection, config: AppConfig): Services => {
    const transitNetworkDataService = new TransitNetworkDataService(db)
    const reportsService = new ReportsService(db, transitNetworkDataService, {
        nodeEnv: config.nodeEnv,
        telegramWorkerUrl: config.telegramWorkerUrl,
        reportPassword: config.reportPassword,
    })
    const riskService = new RiskService(reportsService, transitNetworkDataService)

    return { transitNetworkDataService, reportsService, riskService }
}

// Memoize the db client (the expensive part) per connection string. Services are built per
// Request instead, so config like NODE_ENV stays current and no request state is shared.
let cachedDb: { key: string; db: DbConnection } | null = null

const getDb = (env: Bindings): DbConnection => {
    const key = resolveConnectionString(env)
    if (cachedDb && cachedDb.key === key) {
        return cachedDb.db
    }
    const db = createDb(key)
    cachedDb = { key, db }
    return db
}

export const registerContext = (app: Hono<Env>) => {
    app.use('*', async (c, next) => {
        // Set the logger first so the error handler can log even if resolveConfig below throws.
        c.set('logger', createLogger(c.env.LOG_LEVEL ?? 'info'))

        const config = resolveConfig(c.env)
        const services = createServices(getDb(c.env), config)

        c.set('config', config)
        c.set('reportsService', services.reportsService)
        c.set('riskService', services.riskService)
        c.set('transitNetworkDataService', services.transitNetworkDataService)

        await next()
    })
}
