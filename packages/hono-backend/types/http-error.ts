export type InternalCode = 'TELEGRAM_NOTIFICATION_FAILED'

export interface ServerErrorDetails {
    internal_code: InternalCode
    description?: string
}

export interface ServerErrorBody {
    message: string
    details: ServerErrorDetails
}
