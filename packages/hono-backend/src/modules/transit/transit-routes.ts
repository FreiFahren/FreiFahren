import { z } from 'zod'

import { Env } from '../../app-env'
import { defineRoute } from '../../common/router'
import { ROUTE_TYPE_PRIORITY } from '../../db/seed/config'

export const getStations = defineRoute<Env>()({
    method: 'get' as const,
    path: '/stations',
    docs: {
        summary: 'List stations',
        description: 'Returns all transit stations in the network.',
        tags: ['transit'],
        responseSchema: z.record(
            z.string(),
            z.object({
                name: z.string(),
                coordinates: z.object({
                    latitude: z.number(),
                    longitude: z.number(),
                }),
                lines: z.array(z.string()),
            })
        ),
    },
    handler: async (c) => {
        const transitNetworkDataService = c.get('transitNetworkDataService')
        return c.json(await transitNetworkDataService.getStations())
    },
})

export const getLines = defineRoute<Env>()({
    method: 'get' as const,
    path: '/lines',
    docs: {
        summary: 'List lines',
        description: 'Returns all transit lines in the network.',
        tags: ['transit'],
        responseSchema: z.array(
            z.object({
                id: z.string(),
                name: z.string(),
                type: z.enum(ROUTE_TYPE_PRIORITY),
                isCircular: z.boolean(),
                stations: z.array(z.string()),
            })
        ),
    },
    handler: async (c) => {
        const transitNetworkDataService = c.get('transitNetworkDataService')
        return c.json(await transitNetworkDataService.getLines())
    },
})

export const getSegments = defineRoute<Env>()({
    method: 'get' as const,
    path: '/segments',
    docs: {
        summary: 'List segments',
        description: 'Returns all transit line segments as GeoJSON features.',
        tags: ['transit'],
        responseSchema: z.object({
            type: z.literal('FeatureCollection'),
            features: z.array(
                z.object({
                    type: z.literal('Feature'),
                    properties: z.object({
                        line: z.string(),
                        from: z.string(),
                        to: z.string(),
                        color: z.string(),
                    }),
                    geometry: z.object({
                        type: z.literal('LineString'),
                        coordinates: z.array(z.tuple([z.number(), z.number()])),
                    }),
                })
            ),
        }),
    },
    handler: async (c) => {
        const transitNetworkDataService = c.get('transitNetworkDataService')
        return c.json(await transitNetworkDataService.getSegments())
    },
})

export const getDistance = defineRoute<Env>()({
    method: 'get' as const,
    path: '/distance',
    docs: {
        summary: 'Get distance between stations',
        description: 'Returns the shortest distance between two station ids.',
        tags: ['transit'],
        querySchema: z.object({
            from: z.string().min(1),
            to: z.string().min(1),
        }),
    },
    schemas: {
        query: z.object({
            from: z.string().min(1),
            to: z.string().min(1),
        }),
        response: z.object({
            distance: z.number(),
        }),
    },
    handler: async (c) => {
        const transitNetworkDataService = c.get('transitNetworkDataService')
        const query = c.req.valid('query')
        const distance = await transitNetworkDataService.getDistance(query.from, query.to)
        return c.json({ distance })
    },
})
