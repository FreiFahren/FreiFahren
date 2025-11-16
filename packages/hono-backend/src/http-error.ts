export type InternalCode = 'TELEGRAM_NOTIFICATION_FAILED'

export interface HttpErrorDetails {
    internal_code: InternalCode
    description?: string
}

export interface HttpErrorBody {
    message: string
    details: HttpErrorDetails
}
