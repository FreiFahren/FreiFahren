import { Hono } from 'hono'
import { PinoLogger } from 'hono-pino'

import { ReportsService } from './modules/reports'
import { TransitNetworkDataService } from './modules/transit/transit-network-data-service'

export type Services = {
    reportsService: ReportsService
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
