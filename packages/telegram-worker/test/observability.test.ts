import { describe, expect, it } from 'vitest'
import { redactTelegramBotTokenFromBreadcrumb, redactTelegramBotTokenFromSpan } from '../src/observability'

describe('redactTelegramBotTokenFromBreadcrumb', () => {
    it('removes the bot token from Telegram fetch breadcrumbs', () => {
        const breadcrumb = {
            category: 'fetch',
            type: 'http',
            data: {
                method: 'POST',
                status_code: 500,
                url: 'https://api.telegram.org/bot123456789:super-secret/sendMessage',
            },
        }

        expect(redactTelegramBotTokenFromBreadcrumb(breadcrumb)).toEqual({
            ...breadcrumb,
            data: {
                ...breadcrumb.data,
                url: 'https://api.telegram.org/bot[REDACTED]/sendMessage',
            },
        })
        expect(breadcrumb.data.url).toContain('super-secret')
    })

    it('also redacts Telegram bot API URLs rendered in breadcrumb messages', () => {
        const breadcrumb = {
            category: 'request',
            message: 'POST https://api.telegram.org/bot123456789:super-secret/sendMessage failed',
        }

        expect(redactTelegramBotTokenFromBreadcrumb(breadcrumb).message).toBe(
            'POST https://api.telegram.org/bot[REDACTED]/sendMessage failed'
        )
    })

    it('leaves unrelated breadcrumbs unchanged', () => {
        const breadcrumb = {
            category: 'fetch',
            data: { url: 'https://api.telegram.org.evil.example/bot123456789:super-secret/sendMessage' },
        }

        expect(redactTelegramBotTokenFromBreadcrumb(breadcrumb)).toBe(breadcrumb)
    })
})

describe('redactTelegramBotTokenFromSpan', () => {
    it('removes the bot token from traced Telegram requests', () => {
        const span = {
            data: {
                'http.request.method': 'POST',
                'url.full': 'https://api.telegram.org/bot123456789:super-secret/sendMessage',
            },
            description: 'POST https://api.telegram.org/bot123456789:super-secret/sendMessage',
            span_id: '1234567890abcdef',
            start_timestamp: 1,
            trace_id: '1234567890abcdef1234567890abcdef',
        }

        expect(redactTelegramBotTokenFromSpan(span)).toEqual({
            ...span,
            data: {
                ...span.data,
                'url.full': 'https://api.telegram.org/bot[REDACTED]/sendMessage',
            },
            description: 'POST https://api.telegram.org/bot[REDACTED]/sendMessage',
        })
    })
})
