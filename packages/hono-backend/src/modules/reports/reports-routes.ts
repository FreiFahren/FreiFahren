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

        const latestTimestamp = await reportsService.getLatestReportTimestamp()

        if (latestTimestamp !== undefined) {
            // ToHTTP() returns null only for invalid DateTime objects; latestTimestamp is always valid here
            const lastModified = latestTimestamp.toHTTP()!
            const ifModifiedSince = c.req.header('If-Modified-Since')

            if (ifModifiedSince !== undefined) {
                const clientTimestamp = DateTime.fromHTTP(ifModifiedSince)
                // Truncate server timestamp to second to match HTTP-date precision before comparing
                const serverTimestampTruncated = latestTimestamp.startOf('second')

                // Only return 304 when the client's timestamp exactly matches the server's latest.
                // If the client has a future timestamp (e.g. clock skew), fall through to return fresh data.
                if (serverTimestampTruncated.valueOf() === clientTimestamp.valueOf()) {
                    return new Response(null, {
                        status: 304,
                        headers: { 'Last-Modified': lastModified },
                    })
                }
            }

            c.header('Last-Modified', lastModified)
        }

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
