import { createExecutionContext, fetchMock, waitOnExecutionContext } from 'cloudflare:test'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { CITIES } from '@freifahren/cities'
import { TelegramNotificationsEntrypoint } from '../src/index'
import type { AcceptedReportNotification } from '../src/types'
import type { Env } from '../src/types'

const notification: AcceptedReportNotification = {
    city: 'leipzig',
    report: {
        reportId: 1,
        stationId: 'station-a',
        lineId: 'line-a',
        directionId: 'station-b',
        timestamp: '2026-09-05T12:00:00.000Z',
        source: 'web_app',
    },
}
const bindings: Env = {
    NODE_ENV: 'production',
    BACKEND_URL: 'https://notification-transit.test',
    SENTRY_DSN: '',
    MISTRAL_MODEL: 'unused',
    MISTRAL_API_KEY: 'unused',
    TELEGRAM_WEBHOOK_SECRET: 'unused',
    TELEGRAM_BOT_TOKEN: '1:test-secret',
    REPORT_API: { intake: async () => ({ ok: true, data: {} }) },
}
let messages: Record<string, unknown>[] = []
let transitReads = 0
let telegramStatus = 200
let telegramBody: object = { ok: true }
const deliver = async (input: unknown = notification, overrides: Partial<Env> = {}) => {
    const ctx = createExecutionContext()
    const entrypoint = new TelegramNotificationsEntrypoint(ctx, {
        ...bindings,
        ...overrides,
        REPORT_API: {
            fetch: async () => new Response(),
            connect: () => {
                throw new Error('Unused binding')
            },
        },
    } as ConstructorParameters<typeof TelegramNotificationsEntrypoint>[1])
    try {
        await entrypoint.reportAccepted(input as AcceptedReportNotification)
    } finally {
        await waitOnExecutionContext(ctx)
    }
}

beforeAll(() => {
    fetchMock.activate()
    fetchMock.disableNetConnect()
    fetchMock
        .get(bindings.BACKEND_URL)
        .intercept({ path: '/v0/transit/stations?city=leipzig' })
        .reply(() => {
            transitReads++
            return { statusCode: 200, data: { 'station-a': { name: 'A & <B>' }, 'station-b': { name: 'C' } } }
        })
        .persist()
    fetchMock
        .get(bindings.BACKEND_URL)
        .intercept({ path: '/v0/transit/lines?city=leipzig' })
        .reply(() => {
            transitReads++
            return { statusCode: 200, data: [{ id: 'line-a', name: 'L<1>', stations: ['station-a', 'station-b'] }] }
        })
        .persist()
    fetchMock
        .get('https://api.telegram.org')
        .intercept({ path: '/bot1:test-secret/sendMessage', method: 'POST' })
        .reply((options) => {
            messages.push(JSON.parse(String(options.body)))
            return { statusCode: telegramStatus, data: telegramBody }
        })
        .persist()
})
afterAll(() => {
    fetchMock.enableNetConnect()
    fetchMock.deactivate()
})
beforeEach(async () => {
    messages = []
    transitReads = 0
    telegramStatus = 200
    telegramBody = { ok: true }
    const cache = (caches as CacheStorage & { default: Cache }).default
    await Promise.all(
        ['stations', 'lines'].map((name) => cache.delete(`${bindings.BACKEND_URL}/v0/transit/${name}?city=leipzig`))
    )
})

describe('accepted report notifications', () => {
    it('resolves the destination, names and HTML in the Telegram worker and caches transit reads', async () => {
        await deliver()
        expect(messages).toHaveLength(1)
        expect(messages[0]).toMatchObject({ chat_id: CITIES.leipzig.community.telegramChatId, parse_mode: 'HTML' })
        expect(messages[0].text).toContain('A &amp; &lt;B&gt;')
        expect(messages[0].text).toContain('L&lt;1&gt;')
        expect(messages[0].text).toContain(CITIES.leipzig.publicAppUrl)
        await deliver({ ...notification, report: { ...notification.report, reportId: 2 } })
        expect(messages).toHaveLength(2)
        expect(transitReads).toBe(2)
    })
    it('skips disabled cities, Telegram echoes and non-production delivery before doing any I/O', async () => {
        await deliver({ ...notification, city: 'berlin' })
        await deliver({ ...notification, report: { ...notification.report, source: 'telegram' } })
        await deliver(notification, { NODE_ENV: 'development' })
        expect(messages).toHaveLength(0)
        expect(transitReads).toBe(0)
    })
    it.each([
        { ...notification, city: 'unknown' },
        { ...notification, chatId: 'arbitrary-chat' },
        { ...notification, report: { ...notification.report, text: '<b>arbitrary</b>' } },
    ])('rejects unknown cities and caller-controlled delivery fields', async (input) => {
        await expect(deliver(input)).rejects.toBeInstanceOf(Error)
        expect(messages).toHaveLength(0)
        expect(transitReads).toBe(0)
    })
    it('fails without a token rather than silently dropping an enabled notification', async () => {
        await expect(deliver(notification, { TELEGRAM_BOT_TOKEN: undefined })).rejects.toBeInstanceOf(Error)
        expect(transitReads).toBe(0)
    })
    it.each(['stationId', 'lineId', 'directionId'])('rejects unknown %s without sending', async (field) => {
        await expect(
            deliver({ ...notification, report: { ...notification.report, [field]: 'missing' } })
        ).rejects.toBeInstanceOf(Error)
        expect(messages).toHaveLength(0)
    })
    it.each([200, 400, 429])('surfaces Telegram errors without leaking the token or retrying (%s)', async (status) => {
        telegramStatus = status
        telegramBody = { ok: false, description: 'Failure for 1:test-secret' }
        const error = await deliver().catch((error) => error as Error)
        expect(error).toBeInstanceOf(Error)
        expect(String(error)).not.toContain('1:test-secret')
        expect(messages).toHaveLength(1)
    })
})
