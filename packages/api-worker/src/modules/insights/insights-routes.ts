import { z } from 'zod'

import { Env } from '../../app-env'
import { defineRoute } from '../../common/router'

export const getStationInsights = defineRoute<Env>()({
    method: 'get',
    path: '/station/:stationId',
    schemas: {
        param: z.object({ stationId: z.string().min(1) }),
    },
    handler: async (c) => {
        const { stationId } = c.req.valid('param')
        return c.json(await c.get('insightsService').getStationInsights(stationId))
    },
})

export const getLineInsights = defineRoute<Env>()({
    method: 'get',
    path: '/line/:lineId',
    schemas: {
        param: z.object({ lineId: z.string().min(1) }),
    },
    handler: async (c) => {
        const { lineId } = c.req.valid('param')
        return c.json(await c.get('insightsService').getLineInsights(lineId))
    },
})
