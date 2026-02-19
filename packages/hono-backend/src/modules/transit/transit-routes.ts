import type { Handler } from 'hono'
import { etag } from 'hono/etag'

import { Env } from '../../app-env'
import { defineRoute } from '../../common/router'

export const getStations = defineRoute<Env>()({
    method: 'get' as const,
    path: 'v0/transit/stations',
    middlewares: [etag() as Handler<Env>],
    handler: async (c) => {
        const transitNetworkDataService = c.get('transitNetworkDataService')
        return c.json(await transitNetworkDataService.getStations())
    },
})

export const getLines = defineRoute<Env>()({
    method: 'get' as const,
    path: 'v0/transit/lines',
    middlewares: [etag() as Handler<Env>],
    handler: async (c) => {
        const transitNetworkDataService = c.get('transitNetworkDataService')
        return c.json(await transitNetworkDataService.getLines())
    },
})

export const getSegments = defineRoute<Env>()({
    method: 'get' as const,
    path: 'v0/transit/segments',
    middlewares: [etag() as Handler<Env>],
    handler: async (c) => {
        const transitNetworkDataService = c.get('transitNetworkDataService')
        return c.json(await transitNetworkDataService.getSegments())
    },
})
