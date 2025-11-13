import { Hono } from 'hono'

import { registerServices, Services, type Env } from './app-env'
import { registerRoutes } from './common/router'
import { db, DbConnection } from './db'
import { getReports, postReport, ReportsService } from './modules/reports/'
import { TransitNetworkDataService } from './modules/transit/transit-network-data-service'
import { getStations } from './modules/transit/transit-routes'

const app = new Hono<Env>()

const createServices = (db: DbConnection) => {
    const transitNetworkDataService = new TransitNetworkDataService(db)

    const reportsService = new ReportsService(db, transitNetworkDataService)

    return { transitNetworkDataService, reportsService } satisfies Services
}

registerServices(app, createServices(db))

registerRoutes(app, [getReports, postReport, getStations])

export default app
