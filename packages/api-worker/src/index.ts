import { Context, Hono } from 'hono'
import { cors } from 'hono/cors'
import { etag, RETAINED_304_HEADERS } from 'hono/etag'
import { requestId } from 'hono/request-id'

import { Env, registerContext } from './app-env'
import { handleError } from './common/error-handler'
import { registerVersionedRoutes } from './common/router'
import { getReports, getReportsByStation, postReport } from './modules/reports/'
import { getRisk } from './modules/risk/risk-routes'
import {
    transitCacheMiddleware,
    VERSIONED_TRANSIT_CACHEABLE_PATHS,
    VERSIONED_TRANSIT_PATH,
} from './modules/transit/transit-cache-middleware'
import { getDistance, getLines, getSegments, getStations } from './modules/transit/transit-routes'

export const createApp = () => {
    const app = new Hono<Env>()

    app.use(requestId())

    registerContext(app)

    // Request summary log.
    app.use('*', async (c, next) => {
        const start = Date.now()
        await next()
        c.get('logger').info(
            {
                method: c.req.method,
                path: new URL(c.req.url).pathname,
                status: c.res.status,
                ms: Date.now() - start,
            },
            'request'
        )
    })

    app.use(
        '*',
        cors({
            origin: (origin, c) => {
                const allowed = (c as Context<Env>).get('config').corsOrigins
                return allowed.includes(origin) ? origin : null
            },
            allowHeaders: ['Accept', 'Content-Type', 'If-Modified-Since', 'If-None-Match', 'ff-platform'],
            allowMethods: ['GET', 'POST', 'OPTIONS'],
            exposeHeaders: ['ETag', 'Last-Modified'],
        })
    )
    // Workers Cache stores these cacheable responses before invoking this handler.
    for (const path of VERSIONED_TRANSIT_CACHEABLE_PATHS) {
        app.use(path, transitCacheMiddleware)
    }
    app.use(
        VERSIONED_TRANSIT_PATH,
        etag({
            retainedHeaders: [
                ...RETAINED_304_HEADERS,
                'access-control-allow-origin',
                'access-control-allow-credentials',
                'access-control-expose-headers',
            ],
        })
    )

    app.onError(handleError)

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

export const app = createApp()
