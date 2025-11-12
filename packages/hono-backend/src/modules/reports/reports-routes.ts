import { Context } from 'hono'
import { isNil } from 'lodash'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { Env } from '../../app-env'
import { defineRoute } from '../../common/router'
import { InsertReport, insertReportSchema } from '../../db'

export const getReports = defineRoute<Env>()({
    method: 'get',
    path: 'v0/reports',
    schemas: {
        query: z
            .object({
                from: z.iso
                    .datetime()
                    .transform((iso) => DateTime.fromISO(iso))
                    .optional(),
                to: z.iso
                    .datetime()
                    .transform((iso) => DateTime.fromISO(iso))
                    .optional(),
            })
            .refine(({ to, from }) => {
                if (isNil(from) !== isNil(to)) return false

                if (isNil(to) || isNil(from)) return true

                const range = to.diff(from)

                return range.toMillis() > 0 && range.as('days') <= 7
            }),
    },
    handler: async (c) => {
        const reportsService = c.get('reportsService')

        const query = c.req.valid('query')

        const range = {
            from: query.from ?? DateTime.now().minus({ minutes: 59 }),
            to: query.to ?? DateTime.now(),
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
