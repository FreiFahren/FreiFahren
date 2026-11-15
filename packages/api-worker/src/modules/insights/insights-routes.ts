import { z } from 'zod'

import { Env } from '../../app-env'
import { defineRoute } from '../../common/router'

import { REPORT_SUMMARY_PERIODS } from './report-summary'

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
    path: '/lines/:lineName',
    schemas: {
        param: z.object({ lineName: z.string().min(1) }),
    },
    handler: async (c) => {
        const { lineName } = c.req.valid('param')
        return c.json(await c.get('insightsService').getLineInsights(lineName))
    },
})

export const getLinesInsights = defineRoute<Env>()({
    method: 'get',
    path: '/lines',
    schemas: {
        query: z.object({
            names: z
                .string()
                .transform((value) => value.split(','))
                .pipe(z.array(z.string().min(1).max(100)).min(1).max(50)),
        }),
    },
    handler: async (c) => {
        const { names } = c.req.valid('query')
        return c.json(await c.get('insightsService').getLinesInsights(names))
    },
})

export const getReportSummary = defineRoute<Env>()({
    method: 'get',
    path: '/summary',
    schemas: {
        query: z.object({ period: z.enum(REPORT_SUMMARY_PERIODS).default('24h') }),
    },
    handler: async (c) => {
        const { period } = c.req.valid('query')
        return c.json(await c.get('insightsService').getReportSummary(period))
    },
})
