import { z } from 'zod'

import { Env } from '../../app-env'
import { defineRoute } from '../../common/router'

export const getStations = defineRoute<Env>()({
    method: 'get' as const,
    path: 'v0/transit/stations',
    handler: async (c) => {
        const transitNetworkDataService = c.get('transitNetworkDataService')
        return c.json(await transitNetworkDataService.getStations())
    },
})

export const getDistance = defineRoute<Env>()({
    method: 'get' as const,
    path: 'v0/transit/distance',
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

        return c.json({ distance })
    },
})
