import { isNil } from 'lodash'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { Env } from '../../app-env'
import { defineRoute } from '../../common/router'
import { insertReportSchema } from '../../db'
import { assertPublicReportIntakeEnabled, submitToReportGate } from '../report-gate'

import { getDefaultReportsRange, MAX_REPORTS_TIMEFRAME } from './constants'
import { resolveViewer } from './viewer'

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
        const now = DateTime.now().setZone(c.get('city').timezone)

        c.header('Cache-Control', 'no-store')

        // The query schema fills in the default range when from/to are absent.
        return c.json(
            await reportsService.getReports({
                from: query.from,
                to: query.to,
                currentTime: now,
                viewer: await resolveViewer(c),
            })
        )
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
                currentTime: DateTime.now().setZone(c.get('city').timezone),
                viewer: await resolveViewer(c),
            })
        )
    },
})

export const postReport = defineRoute<Env>()({
    method: 'post',
    path: '/',
    schemas: {
        json: insertReportSchema,
    },
    handler: async (c) => {
        assertPublicReportIntakeEnabled(c)
        const input = c.req.valid('json')
        const report = await c
            .get('reportSubmissionService')
            .submitPublicReport(input, (normalized) => submitToReportGate(c, normalized))

        return c.json(report)
    },
})
