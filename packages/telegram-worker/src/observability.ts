import { captureException, type Breadcrumb, type CloudflareOptions } from '@sentry/cloudflare'

const TELEGRAM_BOT_API_TOKEN = /(https:\/\/api\.telegram\.org\/bot)[^/\s?#]+/gi

const redactTelegramBotApiUrl = (value: string): string => value.replace(TELEGRAM_BOT_API_TOKEN, '$1[REDACTED]')

type SentrySpan = Parameters<NonNullable<CloudflareOptions['beforeSendSpan']>>[0]

export function redactTelegramBotTokenFromBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
    const message = breadcrumb.message === undefined ? undefined : redactTelegramBotApiUrl(breadcrumb.message)
    const url = breadcrumb.data?.url
    const redactedUrl = typeof url === 'string' ? redactTelegramBotApiUrl(url) : url

    if (message === breadcrumb.message && redactedUrl === url) return breadcrumb

    return {
        ...breadcrumb,
        ...(message === undefined ? {} : { message }),
        ...(redactedUrl === url ? {} : { data: { ...breadcrumb.data, url: redactedUrl } }),
    }
}

export function redactTelegramBotTokenFromSpan(span: SentrySpan): SentrySpan {
    const description = span.description === undefined ? undefined : redactTelegramBotApiUrl(span.description)
    let data = span.data

    for (const [key, value] of Object.entries(span.data)) {
        if (typeof value !== 'string') continue
        const redactedValue = redactTelegramBotApiUrl(value)
        if (redactedValue === value) continue
        if (data === span.data) data = { ...span.data }
        data[key] = redactedValue
    }

    if (description === span.description && data === span.data) return span

    return {
        ...span,
        ...(description === undefined ? {} : { description }),
        data,
    }
}

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
