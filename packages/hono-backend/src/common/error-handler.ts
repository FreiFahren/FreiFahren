import { Context } from 'hono'
import { ContentfulStatusCode } from 'hono/utils/http-status'

import { AppError } from './errors'

export const handleError = (err: Error, c: Context) => {
    if (err instanceof AppError) {
        c.get('logger').error(
            {
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
                    description: process.env.NODE_ENV === 'development' ? err.description : undefined,
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
                description: process.env.NODE_ENV === 'development' ? err.message : undefined,
            },
        },
        500 as ContentfulStatusCode
    )
}
