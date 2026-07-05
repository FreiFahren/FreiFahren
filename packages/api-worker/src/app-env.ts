import type { D1Database } from '@cloudflare/workers-types'
import { CITY_SLUGS, type CityConfig, DEFAULT_CITY_SLUG, getCity } from '@freifahren/cities'
import { Context, Hono } from 'hono'

import { AppError } from './common/errors'
import { createLogger, Logger, LogLevel } from './common/logger'
import { createD1Db, DbConnection } from './db'
import { ReportsService } from './modules/reports'
import { RiskService } from './modules/risk'
import type { CacheCtx } from './modules/transit/reference-cache'
import { TransitNetworkDataService } from './modules/transit/transit-network-data-service'

export type Bindings = {
    // Cloudflare D1 binding. Present on Workers and, in tests, provided by the Miniflare pool.
    DB?: D1Database
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
        // The city resolved for this request (from `?city=`), the single source for
        // Which DB the request talks to and how downstream code scopes per-city work.
        city: CityConfig
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

// Injected by worker.ts so @sentry/cloudflare stays out of index.ts and the test bundle.
export type ErrorReporter = (
    error: unknown,
    context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }
) => void

let errorReporter: ErrorReporter = () => undefined

export const setErrorReporter = (reporter: ErrorReporter) => {
    errorReporter = reporter
}

export const reportError: ErrorReporter = (error, context) => errorReporter(error, context)

// Injected by worker.ts to set a tag on the current Sentry request scope (via
// @sentry/cloudflare's AsyncLocalStorage scope). Injected — like reportError above —
// So the SDK stays out of index.ts and the test bundle. No-op until injected.
type ScopeTagger = (key: string, value: string) => void

let scopeTagger: ScopeTagger = () => undefined

export const setScopeTagger = (tagger: ScopeTagger) => {
    scopeTagger = tagger
}

// Resolve the request's city from the explicit `?city=` query parameter. It is a
// Query param, not a header, because the transit edge cache keys on the full request
// URL — a header would let one city's cached responses serve another. A missing param
// Defaults to Berlin (legacy clients: the Capacitor app and old PWA shells); an unknown
// City is a 400 rather than a silent fallback.
const resolveCity = (c: Context<Env>): CityConfig => {
    const requested = c.req.query('city') ?? DEFAULT_CITY_SLUG
    const city = getCity(requested)
    if (city === undefined) {
        throw new AppError({
            message: `Unknown city "${requested}"`,
            statusCode: 400,
            internalCode: 'UNKNOWN_CITY',
            description: `Supported cities: ${CITY_SLUGS.join(', ')}`,
        })
    }
    return city
}

// Look up a city's D1 binding by name on the Worker env. Dynamic by design: today
// Every city resolves to the single `DB` binding, but this is the switch that will
// Fan out to per-city bindings (DB_LEIPZIG, …) once they exist.
const cityDbBinding = (env: Bindings, dbBinding: string): D1Database | undefined =>
    (env as unknown as Record<string, D1Database | undefined>)[dbBinding]

const applyServices = (c: Context<Env>, db: DbConnection, config: AppConfig) => {
    // The executionCtx powers the cache write in cachedReference (waitUntil). It throws off
    // Workers (tests, seed CLI), where the cache is absent anyway, so fall back to undefined.
    let cacheCtx: CacheCtx
    try {
        cacheCtx = c.executionCtx
    } catch {
        cacheCtx = undefined
    }

    const transitNetworkDataService = new TransitNetworkDataService(db, c.get('city').slug, cacheCtx)
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

        // Resolve the city first: it decides which DB this request talks to, and every
        // Downstream query goes through the services built from that one binding below.
        const city = resolveCity(c)
        c.set('city', city)
        // Tag the Sentry request scope so every event/transaction is filterable by city.
        scopeTagger('city', city.slug)

        // The city's D1 binding is the connection — no per-request lifecycle to manage. It is
        // Present on Workers and provided by the Miniflare pool in tests; the seed CLI reaches the
        // Same D1 through getPlatformProxy rather than this request path.
        const binding = cityDbBinding(c.env, city.dbBinding)
        if (binding === undefined) {
            throw new Error(`No D1 binding "${city.dbBinding}" bound for city "${city.slug}"`)
        }
        applyServices(c, createD1Db(binding), config)

        await next()
    })
}
