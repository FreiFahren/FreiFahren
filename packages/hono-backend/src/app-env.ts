import { Hono } from 'hono'

import { ReportsService } from './modules/reports'
import { LinesStationService } from './modules/transit/lines-station-service'

export type Services = {
    reportsService: ReportsService
    linesStationService: LinesStationService
}

export type Env = {
    Variables: Services
}

export const registerServices = (app: Hono<Env>, services: Services) => {
    app.use('*', async (c, next) => {
        ;(Object.keys(services) as (keyof Services)[]).forEach((k) => {
            c.set(k, services[k])
        })
        await next()
    })
}
