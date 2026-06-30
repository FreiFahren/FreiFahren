import type { D1Database } from '@cloudflare/workers-types'
import { Context, Hono } from 'hono'

import { createLogger, Logger, LogLevel } from './common/logger'
import { createD1Db, DbConnection } from './db'
import { ReportsService } from './modules/reports'
import { RiskService } from './modules/risk'
import { TransitNetworkDataService } from './modules/transit/transit-network-data-service'

export type Bindings = {
    // Cloudflare D1 binding, present on Workers.
    DB?: D1Database
    // Libsql connection URL (e.g. file:./local.db) for Node runtimes: tests and the seed CLI.
    DATABASE_URL?: string
    CORS_ORIGINS?: string
    NODE_ENV?: string
    TELEGRAM_WORKER_URL?: string
    REPORT_PASSWORD?: string
    SENTRY_DSN?: string
    // Git SHA injected at deploy via `wrangler deploy --var SENTRY_RELEASE:<sha>`; tags Sentry
    // Events with a release so issues can be resolved in the next release. Absent locally.
    SENTRY_RELEASE?: string
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

const resolveNodeUrl = (env: Bindings): string => {
    if (env.DATABASE_URL === undefined || env.DATABASE_URL === '') {
        throw new Error('No database connection: set DATABASE_URL to a libsql URL (Bun/Node)')
    }
    return env.DATABASE_URL
}

// Node runtimes (tests, seed CLI) register a libsql-backed provider here. Keeping it injected
// Rather than imported means libsql never enters the Worker bundle — the Worker uses D1 only.
let nodeDbProvider: ((url: string) => DbConnection) | null = null

export const setNodeDbProvider = (provider: (url: string) => DbConnection) => {
    nodeDbProvider = provider
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

export const registerContext = (app: Hono<Env>) => {
    app.use('*', async (c, next) => {
        // Set the logger first so the error handler can log even if resolveConfig below throws.
        c.set('logger', createLogger(c.env.LOG_LEVEL ?? 'info'))

        const config = resolveConfig(c.env)

        // On Workers the D1 binding is the connection — no per-request lifecycle to manage. Off
        // Workers (tests, seed CLI) there is no binding, so use the injected libsql provider.
        if (c.env.DB !== undefined) {
            applyServices(c, createD1Db(c.env.DB), config)
        } else {
            if (nodeDbProvider === null) {
                throw new Error('No D1 binding and no Node db provider registered (call setNodeDbProvider)')
            }
            applyServices(c, nodeDbProvider(resolveNodeUrl(c.env)), config)
        }

        await next()
    })
}
