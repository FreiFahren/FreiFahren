import type { Context, MiddlewareHandler } from 'hono'

import type { Env } from '../../app-env'
import { AppError } from '../../common/errors'

/*
 * Killswitch for POST /v0/reports, driven by the REPORTING_ENABLED var so it can be flipped with
 * `wrangler deploy --var` instead of a code change and a full release. Absent or anything other
 * than "true" keeps reporting off, so a typo or a forgotten variable fails closed.
 *
 * Telegram-worker's relayed reports still get through via the shared REPORT_PASSWORD/X-Password
 * bypass below.
 */
const isReportingEnabled = (c: Context<Env>): boolean => c.get('config').reportingEnabled

/*
 * Telegram-worker already sends this header (REPORT_PASSWORD, the same secret used for the reverse
 * api-worker -> telegram-worker call) on every relayed report. Reusing it here avoids minting a new
 * shared secret for the bypass.
 */
export const isTrustedWorkerCall = (c: Context<Env>): boolean => {
    const reportPassword = c.get('config').reportPassword
    if (reportPassword === undefined || reportPassword === '') return false
    return c.req.header('X-Password') === reportPassword
}

export const reportsDisabledMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    if (isReportingEnabled(c as Context<Env>) || isTrustedWorkerCall(c as Context<Env>)) {
        return next()
    }

    throw new AppError({
        message: 'Reporting is temporarily disabled',
        statusCode: 503,
        internalCode: 'REPORTING_DISABLED',
        description: 'Report sightings in the Telegram group instead.',
    })
}
