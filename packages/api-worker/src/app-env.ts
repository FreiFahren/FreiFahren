import type { D1Database, KVNamespace } from '@cloudflare/workers-types'
import { CITY_SLUGS, type CityConfig, DEFAULT_CITY_SLUG, getCity } from '@freifahren/cities'
import { Context, Hono } from 'hono'

import { AppError } from './common/errors'
import { createLogger, Logger, LogLevel } from './common/logger'
import { createD1Db, DbConnection } from './db'
import { InsightsService } from './modules/insights'
import { ReportsService } from './modules/reports'
import { RiskService } from './modules/risk'
import type { CacheCtx } from './modules/transit/reference-cache'
import { TransitNetworkDataService } from './modules/transit/transit-network-data-service'

export type Bindings = {
    // Cloudflare D1 binding. Present on Workers and, in tests, provided by the Miniflare pool.
    DB?: D1Database
    DB_LEIPZIG?: D1Database
    /*
     * Trust-flag definitions (see modules/reports/trust.ts). In KV rather than in the bundle so a
     * newly recognised spam pattern is a KV write, not a deploy — a pattern is found while it is
     * running, and a release is the wrong unit of latency for that. Unbound disables scoring.
     */
    TRUST_FLAGS?: KVNamespace
    CORS_ORIGINS?: string
    // This repo's Cloudflare account subdomain (e.g. `freifahren` for `*.freifahren.workers.dev`).
    // Scopes the frontend preview CORS allowance to our own account so another tenant can't claim
    // The `frontend-pr-<n>` name pattern and gain production API access. Unset => no previews.
    PREVIEW_WORKERS_SUBDOMAIN?: string
    NODE_ENV?: string
    TELEGRAM_WORKER_URL?: string
    REPORT_PASSWORD?: string
    // Turnstile secret for the report widget. Unset disables verification entirely.
    TURNSTILE_SECRET_KEY?: string
    /*
     * HMAC secret behind reports.client_hash. Unset stores no client attribution at all, so the
     * deploy that introduces this collects nothing until the secret is set deliberately.
     */
    CLIENT_HASH_SECRET?: string
    // "true" resumes app report submissions; anything else keeps the killswitch on.
    REPORTING_ENABLED?: string
    // "false" puts Turnstile in monitor mode: verify, log, allow through. Anything else enforces.
    TURNSTILE_ENFORCE?: string
    /*
     * How much trust a station must accumulate before its reports are shown, as a number. 1 (the
     * default) means a single honest report is enough, since an unflagged report scores 1. Raise it
     * to 2 or 3 under attack to demand corroboration; 0 disables the check.
     *
     * Note this is the opposite direction from a killswitch: 0 is the *most* permissive setting.
     * REPORTING_ENABLED is what closes the door, and keeping the two separate means neither dial
     * has a value that means the reverse of everything either side of it.
     */
    MIN_STATION_TRUST?: string
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
    turnstileSecretKey?: string
    clientHashSecret?: string
    reportingEnabled: boolean
    turnstileEnforce: boolean
    minStationTrust: number
    // See PREVIEW_WORKERS_SUBDOMAIN on Bindings. Undefined disables preview-origin CORS entirely.
    previewWorkersSubdomain?: string
}

/*
 * Absent, blank or unparseable all fall back to the default rather than to 0. Switching the check
 * off is a decision worth typing a number for, not something a typo or a cleared variable should
 * do quietly.
 */
const parseMinStationTrust = (raw: string | undefined): number => {
    if (raw === undefined || raw.trim() === '') return 1
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Frontend previews are deployed as `frontend-pr-<n>.<our-subdomain>.workers.dev`. Pinning the
// Subdomain (rather than accepting any `*.workers.dev` tenant) keeps a Worker in someone else's
// Cloudflare account from claiming the same name pattern and being granted production API CORS.
const buildPreviewOriginPattern = (subdomain: string) =>
    new RegExp(`^https:\\/\\/frontend-pr-\\d+\\.${escapeRegExp(subdomain)}\\.workers\\.dev$`)

export const isAllowedCorsOrigin = (origin: string, config: AppConfig) => {
    if (config.corsOrigins.includes(origin)) {
        return true
    }
    const { previewWorkersSubdomain } = config
    return previewWorkersSubdomain !== undefined && buildPreviewOriginPattern(previewWorkersSubdomain).test(origin)
}

export type Services = {
    reportsService: ReportsService
    insightsService: InsightsService
    riskService: RiskService
    transitNetworkDataService: TransitNetworkDataService
}

export type Env = {
    Bindings: Bindings
    Variables: Services & {
        logger: Logger
        config: AppConfig
        // This request's city database, both ways round. The drizzle handle is what everything
        // Should use; the raw binding exists for trust scoring, which runs operator-authored SQL
        // From KV and therefore needs real parameter binding rather than a query builder.
        db: DbConnection
        d1: D1Database
        /*
         * Set when a reports response included a row only because it belongs to the requester, so
         * the response differs from the one anyone else would get. The station-scoped cache reads
         * this and declines to store such a response.
         */
        reportsPersonalized?: boolean
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
        turnstileSecretKey: env.TURNSTILE_SECRET_KEY,
        clientHashSecret: env.CLIENT_HASH_SECRET,
        reportingEnabled: env.REPORTING_ENABLED === 'true',
        // Defaults to enforcing: only an explicit "false" downgrades to monitor mode.
        turnstileEnforce: env.TURNSTILE_ENFORCE !== 'false',
        minStationTrust: parseMinStationTrust(env.MIN_STATION_TRUST),
        previewWorkersSubdomain: env.PREVIEW_WORKERS_SUBDOMAIN,
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
// Query param, not a header, because Workers Cache keys requests by URL, preventing one city's cached responses from serving another. A missing param defaults to Berlin (legacy clients: the Capacitor app and old PWA shells); an unknown
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

// Looks up a city's D1 binding by name on the Worker env. Dynamic by design.
// Each city can use its isolated database.
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
        city: c.get('city').slug,
        telegramWorkerUrl: config.telegramWorkerUrl,
        reportPassword: config.reportPassword,
    })

    c.set('config', config)
    c.set('reportsService', reportsService)
    c.set('insightsService', new InsightsService(db, transitNetworkDataService, c.get('city').timezone))
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
        const db = createD1Db(binding)
        c.set('db', db)
        c.set('d1', binding)
        applyServices(c, db, config)

        await next()
    })
}
