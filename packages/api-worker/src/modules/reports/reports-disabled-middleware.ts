import type { Context, MiddlewareHandler } from 'hono'

import type { Env } from '../../app-env'
import { AppError } from '../../common/errors'

// Manual killswitch for POST /v0/reports. Telegram-worker's relayed reports still get through via
// The shared REPORT_PASSWORD/X-Password bypass below. Flip back to false once submissions should resume.
const REPORTING_DISABLED: boolean = true

// Telegram-worker already sends this header (REPORT_PASSWORD, the same secret used for the reverse
// Api-worker -> telegram-worker call) on every relayed report; api-worker just didn't validate it
// Inbound before now. Reusing it here avoids minting a new shared secret for the bypass.
const isTrustedWorkerCall = (c: Context<Env>): boolean => {
    const reportPassword = c.get('config').reportPassword
    if (reportPassword === undefined || reportPassword === '') return false
    return c.req.header('X-Password') === reportPassword
}

export const reportsDisabledMiddleware: MiddlewareHandler<Env> = async (c, next) => {
    if (!REPORTING_DISABLED || isTrustedWorkerCall(c)) {
        return next()
    }

    throw new AppError({
        message: 'Reporting is temporarily disabled',
        statusCode: 503,
        internalCode: 'REPORTING_DISABLED',
        description: 'Report sightings in the Telegram group instead.',
    })
}
