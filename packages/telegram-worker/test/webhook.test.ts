import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { describe, expect, it, vi } from 'vitest'
import { WEBHOOK_SECRET_HEADER, acceptUpdate, handleWebhook } from '../src/webhook'
import { TelegramUpdate } from '../src/types'
import type { Env } from '../src/types'
import { reportError } from '../src/observability'
import { ALLOWED_CHAT_ID } from './fixtures'

// Spy seam for the privacy assertions below; the real implementation writes to Sentry.
vi.mock('../src/observability', () => ({ reportError: vi.fn() }))

const testEnv: Env = {
    BACKEND_URL: 'https://backend.test',
    PUBLIC_APP_URL: 'https://app.example.test',
    TELEGRAM_CHAT_CITIES: { [ALLOWED_CHAT_ID]: 'berlin', '-1002': 'leipzig' },
    MISTRAL_MODEL: 'mistral-small-latest',
    SENTRY_DSN: 'https://example.invalid/1',
    MISTRAL_API_KEY: 'test-mistral-key',
    TELEGRAM_BOT_TOKEN: '1:fake',
    REPORT_PASSWORD: 'password',
    TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
}

function makeUpdate(opts: {
    text?: string
    caption?: string
    chatId?: number | string
    hasPhoto?: boolean
    entities?: { type: string; offset: number; length: number }[]
}): TelegramUpdate {
    const message: Record<string, unknown> = {
        message_id: 100,
        date: 1_716_220_800,
        chat: { id: Number(opts.chatId ?? ALLOWED_CHAT_ID), type: 'supergroup', title: 'tests' },
        from: { id: 42, is_bot: false, first_name: 'Tester' },
    }
    if (opts.text !== undefined) message.text = opts.text
    if (opts.caption !== undefined) message.caption = opts.caption
    if (opts.entities) message.entities = opts.entities
    if (opts.hasPhoto) message.photo = [{ file_id: 'p1', file_unique_id: 'pu1', width: 100, height: 100 }]
    return TelegramUpdate.parse({ update_id: 1, message })
}

describe('acceptUpdate (filtering)', () => {
    it('accepts a text message from the allowed chat', () => {
        expect(acceptUpdate(makeUpdate({ text: 'U2 alex 2x BOS' }), testEnv)).toEqual({
            text: 'U2 alex 2x BOS',
            city: 'berlin',
        })
    })

    it('accepts a photo caption', () => {
        expect(acceptUpdate(makeUpdate({ caption: 'U2 alex 2x BOS', hasPhoto: true }), testEnv)).toEqual({
            text: 'U2 alex 2x BOS',
            city: 'berlin',
        })
    })

    it('ignores a sticker with no text or caption', () => {
        expect(acceptUpdate(makeUpdate({}), testEnv)).toBeNull()
    })

    it('ignores a message from an unallowed chat', () => {
        expect(acceptUpdate(makeUpdate({ text: 'U2 alex 2x BOS', chatId: -9999 }), testEnv)).toBeNull()
    })

    it('ignores bot commands', () => {
        const update = makeUpdate({ text: '/start', entities: [{ type: 'bot_command', offset: 0, length: 6 }] })
        expect(acceptUpdate(update, testEnv)).toBeNull()
    })
})

function webhookRequest(body: unknown, secret = 'webhook-secret'): Request {
    return new Request('https://worker.test/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [WEBHOOK_SECRET_HEADER]: secret },
        body: JSON.stringify(body),
    })
}

function fakeCtx() {
    const promises: Promise<unknown>[] = []
    return {
        ctx: { waitUntil: (p: Promise<unknown>) => void promises.push(p) },
        promises,
    }
}

describe('handleWebhook', () => {
    it('rejects a wrong secret token with 401 and does not process', async () => {
        const process = vi.fn(async () => {})
        const { ctx, promises } = fakeCtx()
        const res = await handleWebhook(
            webhookRequest(makeUpdate({ text: 'U2 alex' }), 'wrong'),
            testEnv,
            ctx,
            process
        )
        expect(res.status).toBe(401)
        expect(process).not.toHaveBeenCalled()
        expect(promises).toHaveLength(0)
    })

    it('returns 200 and processes an accepted message in the background', async () => {
        const process = vi.fn(async () => {})
        const { ctx, promises } = fakeCtx()
        const res = await handleWebhook(
            webhookRequest(makeUpdate({ text: 'U2 alex 2x BOS' })),
            testEnv,
            ctx,
            process
        )
        expect(res.status).toBe(200)
        expect(process).toHaveBeenCalledExactlyOnceWith('U2 alex 2x BOS', expect.anything(), 'berlin')
        expect(promises).toHaveLength(1)
        await Promise.all(promises)
    })

    it('returns 200 without processing a filtered message', async () => {
        const process = vi.fn(async () => {})
        const { ctx, promises } = fakeCtx()
        const res = await handleWebhook(
            webhookRequest(makeUpdate({ text: 'U2 alex', chatId: -9999 })),
            testEnv,
            ctx,
            process
        )
        expect(res.status).toBe(200)
        expect(process).not.toHaveBeenCalled()
        expect(promises).toHaveLength(0)
    })

    it('runs the pipeline in the background of a real ExecutionContext', async () => {
        const processed: string[] = []
        const process = vi.fn(async (text: string) => void processed.push(text))
        const ctx = createExecutionContext()

        const res = await handleWebhook(
            webhookRequest(makeUpdate({ text: 'U8 Hermannplatz' })),
            testEnv,
            ctx,
            process
        )
        expect(res.status).toBe(200)

        // waitOnExecutionContext resolves only after the waitUntil promise settles, proving
        // the pipeline genuinely ran as background work of this request.
        await waitOnExecutionContext(ctx)
        expect(processed).toEqual(['U8 Hermannplatz'])
    })

    it('reports a background failure with only the message length, never the text', async () => {
        vi.mocked(reportError).mockClear()
        const text = 'U2 alex 2x BOS'
        const process = vi.fn(async () => {
            throw new Error('mistral timeout')
        })
        const ctx = createExecutionContext()

        const res = await handleWebhook(webhookRequest(makeUpdate({ text })), testEnv, ctx, process)
        // The failure stays in the background: Telegram still gets its 200 ack.
        expect(res.status).toBe(200)
        await waitOnExecutionContext(ctx)

        expect(reportError).toHaveBeenCalledTimes(1)
        const [, err, extra] = vi.mocked(reportError).mock.calls[0]!
        expect((err as Error).message).toBe('mistral timeout')
        // The privacy invariant: the extra payload carries the length and nothing else — the
        // message text must never reach the (persisted) error report.
        expect(extra).toEqual({ length: text.length, city: 'berlin' })
    })

    it('acks malformed JSON with 200 and does not process', async () => {
        const process = vi.fn(async () => {})
        const { ctx } = fakeCtx()
        const badReq = new Request('https://worker.test/telegram/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', [WEBHOOK_SECRET_HEADER]: 'webhook-secret' },
            body: 'not json',
        })
        const res = await handleWebhook(badReq, testEnv, ctx, process)
        expect(res.status).toBe(200)
        expect(process).not.toHaveBeenCalled()
    })

    it('routes Berlin and Leipzig chats to their configured cities and ignores an unknown chat', async () => {
        const process = vi.fn(async () => {})
        const berlin = fakeCtx()
        const leipzig = fakeCtx()
        const unknown = fakeCtx()

        await handleWebhook(webhookRequest(makeUpdate({ text: 'U2 Alex', chatId: -1001 })), testEnv, berlin.ctx, process)
        await handleWebhook(
            webhookRequest(makeUpdate({ text: '3k Hbf', chatId: -1002 })),
            testEnv,
            leipzig.ctx,
            process
        )
        await handleWebhook(webhookRequest(makeUpdate({ text: 'not allowed', chatId: -9999 })), testEnv, unknown.ctx, process)

        await Promise.all([...berlin.promises, ...leipzig.promises, ...unknown.promises])
        expect(process).toHaveBeenNthCalledWith(1, 'U2 Alex', expect.anything(), 'berlin')
        expect(process).toHaveBeenNthCalledWith(2, '3k Hbf', expect.anything(), 'leipzig')
        expect(process).toHaveBeenCalledTimes(2)
    })
})
