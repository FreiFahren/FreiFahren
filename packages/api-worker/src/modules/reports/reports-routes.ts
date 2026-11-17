import { isNil } from 'lodash'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { Env } from '../../app-env'
import { defineRoute } from '../../common/router'
import { insertReportSchema } from '../../db'
import { submitToReportGate } from '../report-gate'

import { getDefaultReportsRange, MAX_REPORTS_TIMEFRAME } from './constants'
import { resolveViewer } from './viewer'

const reportsQuerySchema = z
    .object({
        mode: z.enum(['live', 'history']).default('history'),
        from: z.iso
            .datetime()
            .transform((str) => DateTime.fromISO(str))
            .optional(),
        to: z.iso
            .datetime()
            .transform((str) => DateTime.fromISO(str))
            .optional(),
    })
    .refine(({ mode, to, from }) => {
        // Live requests use the server clock; accepting a client range would make the intent ambiguous.
        if (mode === 'live') return isNil(from) && isNil(to)
        if (isNil(to) && isNil(from)) return true
        if (isNil(to) || isNil(from)) return false

        if (!from.isValid || !to.isValid) return false

        const range = to.diff(from)

        return range.toMillis() > 0 && range.as('days') <= MAX_REPORTS_TIMEFRAME
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

        const range = query.from && query.to ? { from: query.from, to: query.to } : getDefaultReportsRange(now)
        return c.json(
            await reportsService.getReports({
                ...range,
                mode: query.mode,
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
        const now = DateTime.now().setZone(c.get('city').timezone)
        const range = query.from && query.to ? { from: query.from, to: query.to } : getDefaultReportsRange(now)

        return c.json(
            await reportsService.getReports({
                ...range,
                mode: query.mode,
                stationId,
                currentTime: now,
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
        const input = c.req.valid('json')
        const report = await c
            .get('reportSubmissionService')
            .submitPublicReport(input, (normalized) => submitToReportGate(c, normalized))

        return c.json(report)
    },
})
