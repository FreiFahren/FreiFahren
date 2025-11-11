import { Hono } from 'hono'

import { registerServices, type Env } from './app-env'
import { registerRoutes } from './common/router'
import { db } from './db'
import { getReports, ReportsService } from './modules/reports/'
import { LinesStationService } from './modules/transit/lines-station-service'
import { getStations } from './modules/transit/transit-routes'

const app = new Hono<Env>()

registerServices(app, {
    reportsService: new ReportsService(db),
    linesStationService: new LinesStationService(db),
})

registerRoutes(app, [getReports, getStations])

export default app
