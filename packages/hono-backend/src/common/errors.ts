import { ContentfulStatusCode } from 'hono/utils/http-status'

export type InternalCode =
    | 'TELEGRAM_NOTIFICATION_FAILED'
    | 'UNKNOWN_ERROR'
    | 'SPAM_REPORT_DETECTED'
    | 'VALIDATION_FAILED'
    | 'RISK_MODEL_FAILED'
export interface AppErrorDetails {
    internal_code: InternalCode
    description?: string
}

export interface AppErrorOptions {
    message: string
    statusCode?: ContentfulStatusCode
    internalCode?: InternalCode
    description?: string
}

export class AppError extends Error {
    public readonly statusCode: ContentfulStatusCode
    public readonly internalCode: InternalCode
    public readonly description?: string

    constructor({ message, statusCode = 500, internalCode = 'UNKNOWN_ERROR', description }: AppErrorOptions) {
        super(message)
        this.name = 'AppError'
        this.statusCode = statusCode
        this.internalCode = internalCode
        this.description = description
    }
}
