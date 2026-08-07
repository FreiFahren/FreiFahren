import { isNil } from 'lodash'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { Env, reportError } from '../../app-env'
import { defineRoute } from '../../common/router'
import { insertReportSchema } from '../../db'

import { ANONYMOUS_CLIENT, resolveClientIdentity } from './client-identity'
import { getDefaultReportsRange, MAX_REPORTS_TIMEFRAME } from './constants'
import { invalidateStationReportsCache } from './reports-cache-middleware'
import { isTrustedWorkerCall, reportsDisabledMiddleware } from './reports-disabled-middleware'
import { turnstileMiddleware } from './turnstile'

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
    path: '/',
    schemas: {
        query: reportsQuerySchema,
    },
    handler: async (c) => {
        const reportsService = c.get('reportsService')
        const query = c.req.valid('query')
        const now = DateTime.now()

        c.header('Cache-Control', 'no-store')

        // The query schema fills in the default range when from/to are absent.
        return c.json(await reportsService.getReports({ from: query.from, to: query.to, currentTime: now })) // Intentionally pass in local time
    },
})

export const getReportsByStation = defineRoute<Env>()({
    method: 'get',
    path: '/:stationId',
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
                from: query.from,
                to: query.to,
                stationId,
                currentTime: DateTime.now(),
            })
        ) // Intentionally pass in local time
    },
})

export const postReport = defineRoute<Env>()({
    method: 'post',
    path: '/',
    // Killswitch first: a 503 must not consume the caller's single-use Turnstile token.
    middlewares: [reportsDisabledMiddleware, turnstileMiddleware],
    schemas: {
        json: insertReportSchema,
    },
    handler: async (c) => {
        const reportsService = c.get('reportsService')
        const logger = c.get('logger')

        const reportData = c.req.valid('json')

        const postProcessedReportData = await reportsService.postProcessReport({
            ...reportData,
            source: reportData.source ?? 'telegram',
        })

        /*
         * Telegram relays reach us server-to-server, so the cf data and User-Agent on that hop
         * describe telegram-worker rather than anyone who reported anything — attributing it would
         * be worse than storing nothing. Keyed off the authenticated shared-secret header and not
         * off the body's `source`, which the caller picks and could set to 'telegram' precisely to
         * shed attribution.
         */
        const client = isTrustedWorkerCall(c)
            ? ANONYMOUS_CLIENT
            : await resolveClientIdentity(c, { secret: c.get('config').clientHashSecret })

        const report = await reportsService.createReport(postProcessedReportData, client)

        /*
         * Awaited, not deferred: the app invalidates and refetches this station's count as soon as
         * it sees the 200, so the entry has to be gone before we send it. A colo-local delete is
         * cheap, and a cache miss must never fail a report that is already committed.
         */
        try {
            await invalidateStationReportsCache(
                c.req.url,
                c.req.header('Origin') ?? null,
                c.get('city').slug,
                report.stationId
            )
        } catch (error) {
            logger.warn({ stationId: report.stationId }, 'Failed to invalidate station reports cache')
            reportError(error, { tags: { task: 'reports-cache-invalidation' } })
        }

        // Fire-and-forget: the report is already saved, and a slow Telegram call must not block the response.
        const forward = reportsService.forwardReportToTelegram(postProcessedReportData).catch((error) => {
            reportError(error, {
                tags: { task: 'telegram-report-forward' },
                extra: {
                    stationId: postProcessedReportData.stationId,
                    lineId: postProcessedReportData.lineId,
                    directionId: postProcessedReportData.directionId,
                },
            })
            logger.error(error, 'Failed to forward inspector report to Telegram')
        })

        // No Workers runtime under unit tests, so executionCtx is absent; await there instead.
        let executionCtx: { waitUntil(promise: Promise<unknown>): void } | undefined
        try {
            executionCtx = c.executionCtx
        } catch {
            executionCtx = undefined
        }
        if (executionCtx !== undefined) {
            executionCtx.waitUntil(forward)
        } else {
            await forward
        }

        return c.json(report)
    },
})
