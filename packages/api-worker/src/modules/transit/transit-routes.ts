import { z } from 'zod'

import { Env } from '../../app-env'
import { defineRoute } from '../../common/router'
import { ROUTE_TYPE_PRIORITY } from '../../db/seed/config'

export const getStations = defineRoute<Env>()({
    method: 'get' as const,
    path: '/stations',
    handler: async (c) => {
        const transitNetworkDataService = c.get('transitNetworkDataService')
        return c.json(await transitNetworkDataService.getStations())
    },
})

const linesResponseSchema = z.array(
    z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(ROUTE_TYPE_PRIORITY),
        isCircular: z.boolean(),
        color: z.string(),
        stations: z.array(z.string()),
    })
)

export const getLines = defineRoute<Env>()({
    method: 'get' as const,
    path: '/lines',
    handler: async (c) => {
        const transitNetworkDataService = c.get('transitNetworkDataService')
        // Validate the output so an out-of-enum line type (e.g. a stale
        // "unknown") fails loudly here instead of leaking to clients.
        const lines = linesResponseSchema.parse(await transitNetworkDataService.getLines())
        return c.json(lines)
    },
})

export const getSegments = defineRoute<Env>()({
    method: 'get' as const,
    path: '/segments',
    handler: async (c) => {
        const transitNetworkDataService = c.get('transitNetworkDataService')
        return c.json(await transitNetworkDataService.getSegments())
    },
})

export const getDistance = defineRoute<Env>()({
    method: 'get' as const,
    path: '/distance',
    schemas: {
        query: z.object({
            from: z.string().min(1),
            to: z.string().min(1),
        }),
    },
    handler: async (c) => {
        const transitNetworkDataService = c.get('transitNetworkDataService')
        const query = c.req.valid('query')
        const distance = await transitNetworkDataService.getDistance(query.from, query.to)
        c.header('Cache-Control', 'no-store')
        return c.json({ distance })
    },
})
