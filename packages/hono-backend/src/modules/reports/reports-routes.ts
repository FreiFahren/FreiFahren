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
        const logger = c.get('logger')
        logger.info('Getting reports')
        logger.error('This is a serious error')
        logger.warn('This is a warning')
        logger.debug('This is a debug message')
        logger.trace('This is a trace message')
        logger.fatal('This is a fatal message')

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
        }),
    },
    handler: async (c) => {
        const reportsService = c.get('reportsService')

        const reportData = c.req.valid('json')

        const { telegramNotificationSuccess } = await reportsService.createReport({
            ...reportData,
            source: reportData.source ?? 'telegram',
        })

        if (!telegramNotificationSuccess) {
            c.get('logger').error('Failed to notify Telegram bot about inspector report')
            c.header('X-Telegram-Notification-Status', 'failed')
        }

        return c.json(
            await reportsService.getReports({
                from: DateTime.now().minus({ hours: 1 }),
                to: DateTime.now(),
            })
        )
    },
})
