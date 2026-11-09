import { z } from 'zod'

import { Env, reportError } from '../../app-env'
import { defineRoute } from '../../common/router'

import { type Defer, STATISTICS_PERIODS } from './statistics-service'

export const getStatistics = defineRoute<Env>()({
    method: 'get',
    path: '/',
    schemas: {
        // Fixed periods only: each is one precomputed snapshot, so arbitrary ranges are rejected.
        query: z.object({ period: z.enum(STATISTICS_PERIODS).default('24h') }),
    },
    handler: async (c) => {
        const { period } = c.req.valid('query')
        const statisticsService = c.get('statisticsService')
        const logger = c.get('logger')

        // `executionCtx` throws outside Workers (tests), where the refresh then simply runs inline.
        let defer: Defer | undefined
        try {
            const ctx = c.executionCtx
            defer = (work) =>
                ctx.waitUntil(
                    work.catch((error: unknown) => {
                        logger.error(
                            { period, error: error instanceof Error ? error.message : String(error) },
                            'Background statistics refresh failed'
                        )
                        reportError(error, { tags: { task: 'report-statistics', city: c.get('city').slug } })
                    })
                )
        } catch {
            defer = undefined
        }

        const statistics = await statisticsService.getStatistics(period, new Date(), defer)
        c.set('statisticsRefreshAt', statisticsService.nextRefreshAt(statistics).getTime())
        return c.json(statistics)
    },
})
