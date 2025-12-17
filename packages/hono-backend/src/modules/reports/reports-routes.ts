import { isNil } from 'lodash'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { Env } from '../../app-env'
import { defineRoute } from '../../common/router'
import { insertReportSchema } from '../../db'

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

export const postReport = defineRoute<Env>()({
    method: 'post',
    path: 'v0/reports',
    schemas: {
        json: insertReportSchema.extend({
            source: insertReportSchema.shape.source.optional(),
            // Since the Bot sometimes does not detect a station, we allow undefined
            stationId: insertReportSchema.shape.stationId.optional(),
        }),
    },
    handler: async (c) => {
        const reportsService = c.get('reportsService')

        const reportData = c.req.valid('json')

        const postProcessedReportData = await reportsService.postProcessReport({
            ...reportData,
            source: reportData.source ?? 'telegram',
        })

        const { telegramNotificationSuccess, report } = await reportsService.createReport({
            ...postProcessedReportData,
        })

        if (!telegramNotificationSuccess) {
            c.get('logger').error('Failed to notify Telegram bot about inspector report')
            c.header('X-Telegram-Notification-Status', 'failed')
        }

        return c.json(report)
    },
})
