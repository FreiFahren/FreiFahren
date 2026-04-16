import { Hono } from 'hono'
import { PinoLogger } from 'hono-pino'

import { ReportsService } from './modules/reports'
import { RiskService } from './modules/risk'
import { TransitNetworkDataService } from './modules/transit/transit-network-data-service'

export type Services = {
    reportsService: ReportsService
    riskService: RiskService
    transitNetworkDataService: TransitNetworkDataService
}

export type Env = {
    Variables: Services & {
        logger: PinoLogger
    }
}

export const registerServices = (app: Hono<Env>, services: Services) => {
    app.use('*', async (c, next) => {
        ;(Object.keys(services) as (keyof Services)[]).forEach((k) => {
            c.set(k, services[k])
        })
        await next()
    })
}
