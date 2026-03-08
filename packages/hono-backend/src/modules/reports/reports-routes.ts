import { isNil } from 'lodash'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { Env } from '../../app-env'
import { AppError } from '../../common/errors'
import { defineRoute } from '../../common/router'
import { insertReportSchema } from '../../db'

import { getDefaultReportsRange, MAX_REPORTS_TIMEFRAME } from './constants'

const reportsQuerySchema = z
    .object({
        from: z.iso
            .datetime()
            .transform((str) => DateTime.fromISO(str))
            .optional(),
        to: z.iso
            .datetime()
            .transform((str) => DateTime.fromISO(str))
            .optional(),
    })
    .refine(({ to, from }) => {
        if (isNil(to) && isNil(from)) return true
        if (isNil(to) || isNil(from)) return false

        if (!from.isValid || !to.isValid) return false

        const range = to.diff(from)

        return range.toMillis() > 0 && range.as('days') <= MAX_REPORTS_TIMEFRAME
    })
    .transform((query) => {
        if (!isNil(query.from) && !isNil(query.to)) {
            return {
                from: query.from,
                to: query.to,
            }
        }

        return getDefaultReportsRange(DateTime.now())
    })

export const getReports = defineRoute<Env>()({
    method: 'get',
    path: 'v0/reports',
    schemas: {
        query: reportsQuerySchema,
    },
    handler: async (c) => {
        const reportsService = c.get('reportsService')

        const query = c.req.valid('query')

        return c.json(
            await reportsService.getReports({ from: query.from!, to: query.to!, currentTime: DateTime.now() })
        ) // Intentionally pass in local time
    },
})

export const getReportsByStation = defineRoute<Env>()({
    method: 'get',
    path: 'v0/reports/:stationId',
    schemas: {
        param: z.object({
            stationId: z.string().min(1),
        }),
        query: reportsQuerySchema,
    },
    handler: async (c) => {
        const reportsService = c.get('reportsService')

        const query = c.req.valid('query')
        const { stationId } = c.req.valid('param')

        return c.json(
            await reportsService.getReports({
                from: query.from!,
                to: query.to!,
                stationId,
                currentTime: DateTime.now(),
            })
        ) // Intentionally pass in local time
    },
})

export const postReport = defineRoute<Env>()({
    method: 'post',
    path: 'v0/reports',
    schemas: {
        json: insertReportSchema,
    },
    handler: async (c) => {
        const reportsService = c.get('reportsService')
        const logger = c.get('logger')

        try {
            await reportsService.verifyRequest(c.req.header())
        } catch (err) {
            if (err instanceof AppError && err.internalCode === 'SPAM_REPORT_DETECTED') {
                logger.warn('Spam report blocked by security service')
                return c.json(
                    {
                        message: err.message,
                    },
                    err.statusCode
                )
            }
            logger.error(err, 'Error verifying request with security service')
            return c.json(
                {
                    message: 'Failed to verify request',
                },
                500
            )
        }

        const reportData = c.req.valid('json')

        const postProcessedReportData = await reportsService.postProcessReport({
            ...reportData,
            source: reportData.source ?? 'telegram',
        })

        const { telegramNotificationSuccess, report } = await reportsService.createReport({
            ...postProcessedReportData,
        })

        if (!telegramNotificationSuccess) {
            logger.error('Failed to notify Telegram bot about inspector report')
            c.header('X-Telegram-Notification-Status', 'failed')
        }

        return c.json(report)
    },
})
