import { Context } from 'hono'
import { isNil } from 'lodash'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { Env } from '../../app-env'
import { defineRoute } from '../../common/router'
import { InsertReport, insertReportSchema } from '../../db'

import { getDefaultReportsRange, MAX_REPORTS_TIMEFRAME } from './constants'

export const getReports = defineRoute<Env>()({
    method: 'get',
    path: 'v0/reports',
    schemas: {
        query: z
            .object({
                from: z.iso.datetime().transform((str) => DateTime.fromISO(str)),
                to: z.iso.datetime().transform((str) => DateTime.fromISO(str)),
            })
            .or(
                z.object({
                    from: z.undefined(),
                    to: z.undefined(),
                })
            )
            .refine(({ to, from }) => {
                if (isNil(to) || isNil(from)) return true

                if (!from.isValid || !to.isValid) return false

                const range = to.diff(from)

                return range.toMillis() > 0 && range.as('days') <= MAX_REPORTS_TIMEFRAME
            }),
    },
    handler: async (c) => {
        const reportsService = c.get('reportsService')

        const query = c.req.valid('query')
        const defaultRange = getDefaultReportsRange()

        const range = {
            from: query.from ?? defaultRange.from,
            to: query.to ?? defaultRange.to,
        }

        return c.json(await reportsService.getReports(range))
    },
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getReportSource = (_: Context): InsertReport['source'] => 'telegram'

export const postReport = defineRoute<Env>()({
    method: 'post',
    path: 'v0/reports',
    schemas: {
        json: insertReportSchema.omit({ source: true }),
    },
    handler: async (c) => {
        const reportsService = c.get('reportsService')

        const reportData = c.req.valid('json')

        await reportsService.createReport({
            source: getReportSource(c),
            ...reportData,
        })

        return c.json(
            await reportsService.getReports({
                from: DateTime.now().minus({ hours: 1 }),
                to: DateTime.now(),
            })
        )
    },
})
