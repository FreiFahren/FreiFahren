import { Context } from 'hono'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { Env } from '../../app-env'
import { defineRoute } from '../../common/router'
import { InsertReport, insertReportSchema } from '../../db'

export const getReports = defineRoute<Env>()({
    method: 'get',
    path: 'v0/reports',
    schemas: {
        query: z.object({
            from: z.iso
                .datetime()
                .transform((iso) => DateTime.fromISO(iso))
                .optional(),
            to: z.iso
                .datetime()
                .transform((iso) => DateTime.fromISO(iso))
                .optional(),
        }),
    },
    handler: async (c) => {
        const reportsService = c.get('reportsService')

        const query = c.req.valid('query')

        const range = {
            from: query.from ?? DateTime.now().minus({ minutes: 59 }),
            to: query.to ?? DateTime.now(),
        }

        if (range.to.diff(range.from).as('hours') > 1) {
            return c.json({ message: 'Bad request - range larger than 1h' }, 400)
        }

        return c.json(await reportsService.getReports(range))
    },
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getReportSource = (_: Context): InsertReport['source'] => 'web_app'

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
