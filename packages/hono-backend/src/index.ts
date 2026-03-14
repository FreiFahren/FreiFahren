import { Hono } from 'hono'
import { requestId } from 'hono/request-id'
import { pinoLogger } from 'hono-pino'
import pino from 'pino'

import { registerServices, Services, type Env } from './app-env'
import { handleError } from './common/error-handler'
import { registerVersionedRoutes } from './common/router'
import { db, DbConnection } from './db'
import { postFeedback } from './modules/feedback/feedback-routes'
import { getReports, getReportsByStation, postReport, ReportsService } from './modules/reports/'
import { TransitNetworkDataService } from './modules/transit/transit-network-data-service'
import { getLines, getSegments, getStations } from './modules/transit/transit-routes'

const app = new Hono<Env>()

app.use(requestId())
app.use(
    pinoLogger({
        pino: pino({
            level: process.env.LOG_LEVEL ?? 'info',
            transport: {
                targets: [
                    {
                        target: 'pino-pretty',
                        options: {
                            colorize: true,
                            ignore: 'pid,hostname,req,res,responseTime,reqId',
                            translateTime: 'SYS:standard',
                            destination: 1,
                        },
                    },
                    {
                        target: 'pino-roll',
                        options: {
                            file: './app.log',
                            frequency: 'daily',
                            mkdir: true,
                        },
                    },
                ],
            },
        }),
    })
)

app.onError(handleError)

const createServices = (db: DbConnection) => {
    const transitNetworkDataService = new TransitNetworkDataService(db)

    const reportsService = new ReportsService(db, transitNetworkDataService)

    return { transitNetworkDataService, reportsService } satisfies Services
}

registerServices(app, createServices(db))

registerVersionedRoutes(app, 'reports', 'v0', {
    v0: [getReports, postReport, getReportsByStation],
})

registerVersionedRoutes(app, 'transit', 'v0', {
    v0: [getStations, getLines, getSegments],
})

registerVersionedRoutes(app, 'feedback', 'v0', {
    v0: [postFeedback],
})

export { app }

export default {
    fetch: app.fetch,
    port: 3000,
    hostname: '0.0.0.0',
}
