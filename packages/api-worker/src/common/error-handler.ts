import { Context } from 'hono'
import { ContentfulStatusCode } from 'hono/utils/http-status'

import { AppConfig, Env } from '../app-env'

import { AppError } from './errors'

export const handleError = (err: Error, c: Context<Env>) => {
    // config is unset if registerContext threw before storing it (e.g. missing CORS_ORIGINS or db
    // binding); fall back to hiding descriptions rather than throwing a second error.
    const config = c.get('config') as AppConfig | undefined

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
