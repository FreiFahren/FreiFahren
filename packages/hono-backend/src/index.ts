import { Hono } from 'hono'

import { registerServices, type Env } from './app-env'
import { registerRoutes } from './common/router'
import { db } from './db'
import { getReports, ReportsService } from './modules/reports/'
import { TransitNetworkDataService } from './modules/transit/transit-network-data-service'
import { getStations } from './modules/transit/transit-routes'

const app = new Hono<Env>()

registerServices(app, {
    reportsService: new ReportsService(db),
    transitNetworkDataService: new TransitNetworkDataService(db),
})

registerRoutes(app, [getReports, getStations])

export default app
