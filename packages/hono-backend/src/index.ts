import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { etag, RETAINED_304_HEADERS } from 'hono/etag'
import { requestId } from 'hono/request-id'
import { pinoLogger } from 'hono-pino'

import { registerServices, Services, type Env } from './app-env'
import { handleError } from './common/error-handler'
import { logger } from './common/logger'
import { registerVersionedRoutes } from './common/router'
import { db, DbConnection } from './db'
import { getReports, getReportsByStation, postReport, ReportsService } from './modules/reports/'
import { getRisk } from './modules/risk/risk-routes'
import { RiskService } from './modules/risk/risk-service'
import { TransitNetworkDataService } from './modules/transit/transit-network-data-service'
import { getDistance, getLines, getSegments, getStations } from './modules/transit/transit-routes'

const getCorsOrigins = () => {
    const configuredOrigins = Bun.env.CORS_ORIGINS?.split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin !== '')

    if (configuredOrigins === undefined || configuredOrigins.length === 0) {
        throw new Error('CORS_ORIGINS must be set to a comma-separated list of allowed origins')
    }

    return configuredOrigins
}

const createServices = (db: DbConnection) => {
    const transitNetworkDataService = new TransitNetworkDataService(db)

    const reportsService = new ReportsService(db, transitNetworkDataService)

    const riskService = new RiskService(reportsService, transitNetworkDataService)

    return { transitNetworkDataService, reportsService, riskService } satisfies Services
}

export const createApp = (dbConnection: DbConnection = db) => {
    const app = new Hono<Env>()

    app.use(requestId())
    app.use(
        '*',
        cors({
            origin: getCorsOrigins(),
            allowHeaders: ['Accept', 'Content-Type', 'If-Modified-Since', 'If-None-Match', 'ff-platform'],
            allowMethods: ['GET', 'POST', 'OPTIONS'],
            exposeHeaders: ['ETag', 'Last-Modified'],
        })
    )
    app.use(
        '/v0/transit/*',
        etag({
            retainedHeaders: [
                ...RETAINED_304_HEADERS,
                'access-control-allow-origin',
                'access-control-allow-credentials',
                'access-control-expose-headers',
            ],
        })
    )
    app.use(
        pinoLogger({
            pino: logger,
            http: {
                // The request summary (method, path, status, duration) is rendered by the
                // `messageFormat` in logger.ts, so we intentionally emit an empty `msg` here to
                // avoid duplicating it.
                onResMessage: () => '',
            },
        })
    )

    app.onError(handleError)

    registerServices(app, createServices(dbConnection))
    registerVersionedRoutes(app, 'reports', 'v0', {
        v0: [getReports, postReport, getReportsByStation],
    })
    registerVersionedRoutes(app, 'transit', 'v0', {
        v0: [getStations, getLines, getSegments, getDistance],
    })
    registerVersionedRoutes(app, 'risk', 'v0', {
        v0: [getRisk],
    })

    return app
}

const app = createApp()

export { app }

export default {
    fetch: app.fetch,
    port: 3000,
    hostname: '0.0.0.0',
    idleTimeout: 30,
}
