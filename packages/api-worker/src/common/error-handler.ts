import { Context } from 'hono'
import { ContentfulStatusCode } from 'hono/utils/http-status'

import { AppConfig, Env, reportError } from '../app-env'

import { AppError } from './errors'

export const handleError = (err: Error, c: Context<Env>) => {
    // config is unset if registerContext threw before storing it (e.g. missing CORS_ORIGINS or db
    // binding); fall back to hiding descriptions rather than throwing a second error.
    const config = c.get('config') as AppConfig | undefined

    /*
     * Keyed on the status, not on the error class: an AppError can carry a 500 too — a risk model
     * that failed, a station inference that hit an impossible clock — and those are bugs in exactly
     * the way an uncaught throw is. Capturing is what raises a Sentry issue; logs alone never did,
     * which is why no 500 this API has served was visible there. 4xx stays out: Turnstile refusals
     * and unknown stations are the caller's problem and would drown the signal.
     */
    const statusCode = err instanceof AppError ? err.statusCode : 500
    if (statusCode >= 500) {
        reportError(err, {
            tags: { method: c.req.method, path: new URL(c.req.url).pathname },
        })
    }

    if (err instanceof AppError) {
        c.get('logger').error(
            {
                err,
                internal_code: err.internalCode,
                statusCode: err.statusCode,
                description: err.description,
            },
            err.message
        )
        return c.json(
            {
                message: err.message,
                details: {
                    internal_code: err.internalCode,
                    // We do not want to leak sensitive information to the client in production
                    description: config?.nodeEnv === 'development' ? err.description : undefined,
                },
            },
            err.statusCode
        )
    }

    c.get('logger').error(err, 'Unhandled error')
    return c.json(
        {
            message: 'Internal Server Error',
            details: {
                internal_code: 'UNKNOWN_ERROR',
                // We do not want to leak sensitive information to the client in production
                description: config?.nodeEnv === 'development' ? err.message : undefined,
            },
        },
        500 as ContentfulStatusCode
    )
}
