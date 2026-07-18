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
