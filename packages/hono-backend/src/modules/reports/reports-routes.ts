import { isNil } from 'lodash'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { Env } from '../../app-env'
import { AppError } from '../../common/errors'
import { defineRoute } from '../../common/router'
import { insertReportSchema } from '../../db'

import { getDefaultReportsRange, MAX_REPORTS_TIMEFRAME } from './constants'

export const getReports = defineRoute<Env>()({
    method: 'get',
    path: 'v0/reports',
    docs: {
        summary: 'List reports',
        description: 'Returns reports between an optional from/to ISO datetime range.',
        tags: ['reports'],
        querySchema: z.object({
            from: z.iso.datetime().optional(),
            to: z.iso.datetime().optional(),
        }),
        responseSchema: z.array(
            z.object({
                timestamp: z.iso.datetime(),
                stationId: z.string(),
                directionId: z.string().nullable(),
                lineId: z.string().nullable(),
                isPredicted: z.boolean(),
            })
        ),
    },
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

        return c.json(await reportsService.getReports({ ...range, currentTime: DateTime.now() })) // Intentionally pass in local time
    },
})

export const postReport = defineRoute<Env>()({
    method: 'post',
    path: 'v0/reports',
    docs: {
        summary: 'Create a report',
        description: 'Creates a report after anti-spam verification and post-processing.',
        tags: ['reports'],
        requestSchema: z.object({
            stationId: z.string().max(16).nullable(),
            lineId: z.string().max(16).nullable(),
            directionId: z.string().max(16).nullable(),
            source: z.enum(['mini_app', 'web_app', 'mobile_app', 'telegram']).optional(),
        }),
        responseSchema: z.object({
            reportId: z.number().int(),
            stationId: z.string(),
            lineId: z.string().nullable(),
            directionId: z.string().nullable(),
            timestamp: z.iso.datetime(),
        }),
    },
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
