import { ROUTE_TYPES } from '@freifahren/cities'
import { z } from 'zod'

import { Env } from '../../app-env'
import { defineRoute } from '../../common/router'
import { resolveViewer } from '../reports/viewer'

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
        type: z.enum(ROUTE_TYPES),
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

export const getRoute = defineRoute<Env>()({
    method: 'get' as const,
    path: '/route',
    schemas: {
        query: z
            .object({
                from: z.string().min(1),
                to: z.string().min(1),
            })
            .refine((query) => query.from !== query.to, {
                message: 'from and to must be different stations',
                path: ['to'],
            }),
    },
    handler: async (c) => {
        const routeService = c.get('routeService')
        const { from, to } = c.req.valid('query')
        const plan = await routeService.getRoute({ from, to, viewer: await resolveViewer(c) })
        // Depends on the viewer and on the current time, so it must not be stored at the edge.
        c.header('Cache-Control', 'no-store')
        return c.json(plan)
    },
})
