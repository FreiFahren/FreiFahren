import { Context } from 'hono'
import { ContentfulStatusCode } from 'hono/utils/http-status'

import { AppError } from './errors'

export const handleError = (err: Error, c: Context) => {
    if (err instanceof AppError) {
        return c.json(
            {
                message: err.message,
                details: {
                    internal_code: err.internalCode,
                    description: err.description,
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
                description: process.env.NODE_ENV === 'production' ? undefined : err.message,
            },
        },
        500 as ContentfulStatusCode
    )
}
