import { ContentfulStatusCode } from 'hono/utils/http-status'

export type InternalCode =
    | 'TELEGRAM_NOTIFICATION_FAILED'
    | 'UNKNOWN_ERROR'
    | 'SPAM_REPORT_DETECTED'
    | 'VALIDATION_FAILED'
    | 'RISK_MODEL_FAILED'
    | 'STATION_NOT_FOUND'
    | 'NO_PATH_FOUND'
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

/**
 * Use AppError at service or route boundaries when an error should become a
 * controlled API response with a stable HTTP status and internal code.
 *
 * Lower-level code should prefer regular typed domain errors, such as
 * NoPathFoundError or StationNotFoundError, and let the service layer translate
 * them into AppError when crossing into API-facing behavior.
 */
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

export class NoPathFoundError extends Error {
    constructor(
        public readonly from: string,
        public readonly to: string
    ) {
        super('No path found between stations')
        this.name = 'NoPathFoundError'
    }
}

export class StationNotFoundError extends Error {
    constructor(public readonly stationId: string) {
        super('Station not found')
        this.name = 'StationNotFoundError'
    }
}
