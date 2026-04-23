import { Hono } from 'hono'
import { requestId } from 'hono/request-id'
import { pinoLogger } from 'hono-pino'

import { registerServices, Services, type Env } from './app-env'
import { handleError } from './common/error-handler'
import { logger } from './common/logger'
import { registerVersionedRoutes } from './common/router'
import { db, DbConnection } from './db'
import { postFeedback } from './modules/feedback/feedback-routes'
import { getReports, getReportsByStation, postReport, ReportsService } from './modules/reports/'
import { getRisk } from './modules/risk/risk-routes'
import { RiskService } from './modules/risk/risk-service'
import { TransitNetworkDataService } from './modules/transit/transit-network-data-service'
import { getLines, getSegments, getStations } from './modules/transit/transit-routes'

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
        pinoLogger({
            pino: logger,
        })
    )

    app.onError(handleError)

    registerServices(app, createServices(dbConnection))
    registerVersionedRoutes(app, 'reports', 'v0', {
        v0: [getReports, postReport, getReportsByStation],
    })
    registerVersionedRoutes(app, 'transit', 'v0', {
        v0: [getStations, getLines, getSegments],
    })
    registerVersionedRoutes(app, 'feedback', 'v0', {
        v0: [postFeedback],
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
}
