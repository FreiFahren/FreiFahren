import { env } from 'cloudflare:test'
import { describe, expect, it, vi } from 'vitest'
import { WEBHOOK_SECRET_HEADER, acceptUpdate, handleWebhook } from '../src/webhook'
import { TelegramUpdate } from '../src/types'
import type { Env } from '../src/types'
import { ALLOWED_CHAT_ID } from './fixtures'

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
        expect(acceptUpdate(makeUpdate({ text: 'U2 alex 2x BOS' }), ALLOWED_CHAT_ID)).toBe('U2 alex 2x BOS')
    })

    it('accepts a photo caption', () => {
        expect(acceptUpdate(makeUpdate({ caption: 'U2 alex 2x BOS', hasPhoto: true }), ALLOWED_CHAT_ID)).toBe(
            'U2 alex 2x BOS',
        )
    })

    it('ignores a sticker with no text or caption', () => {
        expect(acceptUpdate(makeUpdate({}), ALLOWED_CHAT_ID)).toBeNull()
    })

    it('ignores a message from an unallowed chat', () => {
        expect(acceptUpdate(makeUpdate({ text: 'U2 alex 2x BOS', chatId: -9999 }), ALLOWED_CHAT_ID)).toBeNull()
    })

    it('ignores bot commands', () => {
        const update = makeUpdate({ text: '/start', entities: [{ type: 'bot_command', offset: 0, length: 6 }] })
        expect(acceptUpdate(update, ALLOWED_CHAT_ID)).toBeNull()
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
        ctx: { waitUntil: (p: Promise<unknown>) => void promises.push(p) } as unknown as ExecutionContext,
        promises,
    }
}

describe('handleWebhook', () => {
    it('rejects a wrong secret token with 401 and does not process', async () => {
        const process = vi.fn(async () => {})
        const { ctx, promises } = fakeCtx()
        const res = await handleWebhook(webhookRequest(makeUpdate({ text: 'U2 alex' }), 'wrong'), env as unknown as Env, ctx, process)
        expect(res.status).toBe(401)
        expect(process).not.toHaveBeenCalled()
        expect(promises).toHaveLength(0)
    })

    it('returns 200 and processes an accepted message in the background', async () => {
        const process = vi.fn(async () => {})
        const { ctx, promises } = fakeCtx()
        const res = await handleWebhook(webhookRequest(makeUpdate({ text: 'U2 alex 2x BOS' })), env as unknown as Env, ctx, process)
        expect(res.status).toBe(200)
        expect(process).toHaveBeenCalledExactlyOnceWith('U2 alex 2x BOS', expect.anything())
        expect(promises).toHaveLength(1)
        await Promise.all(promises)
    })

    it('returns 200 without processing a filtered message', async () => {
        const process = vi.fn(async () => {})
        const { ctx, promises } = fakeCtx()
        const res = await handleWebhook(
            webhookRequest(makeUpdate({ text: 'U2 alex', chatId: -9999 })),
            env as unknown as Env,
            ctx,
            process,
        )
        expect(res.status).toBe(200)
        expect(process).not.toHaveBeenCalled()
        expect(promises).toHaveLength(0)
    })

    it('acks malformed JSON with 200 and does not process', async () => {
        const process = vi.fn(async () => {})
        const { ctx } = fakeCtx()
        const badReq = new Request('https://worker.test/telegram/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', [WEBHOOK_SECRET_HEADER]: 'webhook-secret' },
            body: 'not json',
        })
        const res = await handleWebhook(badReq, env as unknown as Env, ctx, process)
        expect(res.status).toBe(200)
        expect(process).not.toHaveBeenCalled()
    })
})
