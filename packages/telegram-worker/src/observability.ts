import { captureException } from '@sentry/cloudflare'

// Single seam for error reporting. With no queue/retry, a failed pipeline run drops the
// message, so we capture it as a Sentry issue (alert on the error rate) and also log to
// the live tail. captureException works here even under ctx.waitUntil — withSentry binds
// the client via AsyncLocalStorage.
export function reportError(message: string, err: unknown, extra?: Record<string, unknown>): void {
    captureException(err, { extra: { message, ...extra } })
    console.error(message, {
        error: err instanceof Error ? (err.stack ?? err.message) : String(err),
        ...extra,
    })
}
