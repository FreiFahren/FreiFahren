import {
    env,
    createExecutionContext,
    fetchMock,
    waitOnExecutionContext,
    runDurableObjectAlarm,
    runInDurableObject,
} from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CITIES } from '@freifahren/cities'
import { CityDelivery } from '../src/city-delivery'
import { TelegramNotificationsEntrypoint } from '../src/index'
import type { AcceptedReportNotification, Env } from '../src/types'
import { DELIVERY_POLICY as policy } from '../src/delivery-policy'

const start = Date.parse('2030-09-06T12:00:00Z')
let messages: Record<string, unknown>[]
let status: number
let body: object
let duringSend: (() => Promise<void>) | undefined
const report = (id: number, city = 'leipzig'): AcceptedReportNotification => ({
    city,
    report: {
        reportId: id,
        stationId: 'station-a',
        lineId: 'line-a',
        directionId: 'station-b',
        timestamp: new Date(Date.now()).toISOString(),
        source: 'web_app',
    },
})
const accept = async (input: unknown, overrides: Partial<Env> = {}) => {
    const ctx = createExecutionContext()
    const entrypoint = new TelegramNotificationsEntrypoint(ctx, {
        ...env,
        ...overrides,
        REPORT_API: {
            fetch: async () => new Response(),
            connect() {
                throw new Error('Unused')
            },
        },
    } as ConstructorParameters<typeof TelegramNotificationsEntrypoint>[1])
    await entrypoint.reportAccepted(input as AcceptedReportNotification)
    await waitOnExecutionContext(ctx)
}
const stub = (city = 'leipzig') => env.CITY_DELIVERY.getByName(city)
const tick = async (at: number, city = 'leipzig') => {
    vi.setSystemTime(at)
    await runDurableObjectAlarm(stub(city))
}
const alarmTime = (city = 'leipzig') => runInDurableObject(stub(city), (_, ctx) => ctx.storage.getAlarm())

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(start)
    messages = []
    status = 200
    body = { ok: true }
    duringSend = undefined
    CITIES.berlin.reporting.telegramForwardingEnabled = true
    fetchMock.activate()
    fetchMock.disableNetConnect()
    fetchMock.get('https://backend.test').intercept({ path: /./ }).reply(522).persist()
    const originalFetch = globalThis.fetch
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        if (String(input).includes('api.telegram.org') && duringSend) {
            const callback = duringSend
            duringSend = undefined
            await callback()
        }
        return originalFetch(input, init)
    })
    fetchMock
        .get('https://api.telegram.org')
        .intercept({ path: '/bot1:test-secret/sendMessage', method: 'POST' })
        .reply((options) => {
            messages.push(JSON.parse(String(options.body)))
            return { statusCode: status, data: body }
        })
        .persist()
})
afterEach(() => {
    CITIES.berlin.reporting.telegramForwardingEnabled = false
    fetchMock.deactivate()
    vi.restoreAllMocks()
    vi.useRealTimers()
})

describe('automatic city delivery through notification RPC and durable storage', () => {
    it('persists first, sends quiet reports individually through the transit binding, and deduplicates events', async () => {
        const input = report(1)
        await accept(input)
        expect(messages).toHaveLength(0)
        await tick(start + 1)
        expect(messages).toHaveLength(1)
        expect(messages[0]).toMatchObject({ chat_id: CITIES.leipzig.community.telegramChatId, parse_mode: 'HTML' })
        expect(messages[0].text).toContain('A &amp; &lt;B&gt;')
        expect(messages[0].text).toContain('L&lt;1&gt;')
        await accept(input)
        await tick(start + 10_000)
        expect(messages).toHaveLength(1)
    })

    it('forwards three quiet reports immediately, then waits for exactly one refill', async () => {
        for (let id = 1; id <= 3; id++) {
            vi.setSystemTime(start + (id - 1) * 60_000)
            await accept(report(id))
            await tick(Date.now() + 1)
            expect(messages).toHaveLength(id)
            expect(messages[id - 1].text).toContain('<b>Station:</b>')
        }
        await accept(report(4))
        const due = start + 1 + policy.creditRefillMs
        expect(await alarmTime()).toBe(due)
        await tick(due - 1)
        expect(messages).toHaveLength(3)
        await tick(due)
        expect(messages).toHaveLength(4)
        await accept(report(5))
        expect(await alarmTime()).toBe(due + policy.creditRefillMs)
    })

    it('limits sustained spam after the initial budget and collects every new burst', async () => {
        for (let id = 1; id <= 3; id++) {
            await accept(report(id))
            await tick(start + id)
        }
        for (let window = 0; window < 3; window++) {
            const previous = start + 1 + window * policy.creditRefillMs
            vi.setSystemTime(previous + 1_000)
            await Promise.all(Array.from({ length: 100 }, (_, i) => accept(report(4 + window * 100 + i))))
            expect(await alarmTime()).toBe(previous + policy.creditRefillMs)
            await tick(previous + policy.creditRefillMs - 1)
            expect(messages).toHaveLength(window + 3)
            await tick(previous + policy.creditRefillMs)
            expect(messages).toHaveLength(window + 4)
            expect(messages[window + 3].text).toContain('100 neue Meldungen')
        }
    })

    it('refills while idle but never banks more than three credits', async () => {
        await accept(report(1))
        await tick(start + 1)
        const later = start + policy.retentionMs + 1
        await tick(later)
        for (let id = 2; id <= 4; id++) {
            await accept(report(id))
            await tick(later + id)
        }
        expect(messages).toHaveLength(4)
        await accept(report(5))
        expect(await alarmTime()).toBe(later + 2 + policy.creditRefillMs)
        await tick(later + 2 + policy.creditRefillMs - 1)
        expect(messages).toHaveLength(4)
        await tick(later + 2 + policy.creditRefillMs)
        expect(messages).toHaveLength(5)
    })

    it('preserves partial refill time when a returned credit is spent later', async () => {
        for (let id = 1; id <= 3; id++) {
            await accept(report(id))
            await tick(start + id)
        }
        vi.setSystemTime(start + 15 * 60_000)
        await accept(report(4))
        await tick(Date.now() + 1)
        expect(messages).toHaveLength(4)
        await accept(report(5))
        expect(await alarmTime()).toBe(start + 1 + 2 * policy.creditRefillMs)
        await tick(start + 2 * policy.creditRefillMs)
        expect(messages).toHaveLength(4)
        await tick(start + 1 + 2 * policy.creditRefillMs)
        expect(messages).toHaveLength(5)
    })

    it('charges permanent failures against the same budget as successful messages', async () => {
        status = 403
        body = { ok: false }
        for (let id = 1; id <= 3; id++) {
            await accept(report(id))
            await tick(start + id)
        }
        status = 200
        body = { ok: true }
        await accept(report(4))
        await accept(report(5))
        expect(await alarmTime()).toBe(start + 1 + policy.creditRefillMs)
        await tick(start + policy.creditRefillMs)
        expect(messages).toHaveLength(3)
        await tick(start + 1 + policy.creditRefillMs)
        expect(messages).toHaveLength(4)
        expect(messages[3].text).toContain('2 neue Meldungen')
    })

    it('batches concurrent bursts and isolates city budgets and destinations', async () => {
        await Promise.all(Array.from({ length: 8 }, (_, i) => accept(report(i + 1, 'berlin'))))
        await accept(report(1, 'leipzig'))
        await tick(start + 1, 'leipzig')
        expect(messages).toHaveLength(1)
        expect(messages[0].chat_id).toBe(CITIES.leipzig.community.telegramChatId)
        await tick(start + policy.creditRefillMs, 'berlin')
        expect(messages).toHaveLength(2)
        expect(messages[1].chat_id).toBe(CITIES.berlin.community.telegramChatId)
        expect(messages[1].text).toContain('8 neue Meldungen')
    })

    it('returns to individual delivery after a quiet period and sends no empty digests', async () => {
        for (let id = 1; id <= 6; id++) await accept(report(id))
        await tick(start + policy.creditRefillMs)
        expect(messages).toHaveLength(1)
        await tick(start + 2 * policy.creditRefillMs)
        expect(messages).toHaveLength(1)
        vi.setSystemTime(start + 3 * policy.creditRefillMs + 1)
        await accept(report(7))
        await tick(Date.now() + 1)
        expect(messages).toHaveLength(2)
        expect(messages[1].text).toContain('<b>Station:</b>')
    })

    it('keeps arrivals during delivery for the next batch', async () => {
        await accept(report(1))
        duringSend = () => accept(report(2))
        await tick(start + 1)
        expect(messages).toHaveLength(1)
        await tick(start + 2)
        expect(messages).toHaveLength(2)
    })

    it('retains spent credits when the coordinator is reconstructed from durable storage', async () => {
        for (let id = 1; id <= 3; id++) {
            await accept(report(id))
            await tick(start + id)
        }
        await accept(report(4))
        await runInDurableObject(stub(), async (_, ctx) => {
            const restarted = new CityDelivery(ctx, {
                ...env,
                REPORT_API: {
                    fetch: async () => new Response(),
                    connect() {
                        throw new Error('Unused')
                    },
                },
            } as ConstructorParameters<typeof CityDelivery>[1])
            await restarted.alarm()
        })
        expect(messages).toHaveLength(3)
        expect(await alarmTime()).toBe(start + 1 + policy.creditRefillMs)
        await tick(start + 1 + policy.creditRefillMs)
        expect(messages).toHaveLength(4)
    })

    it('honours retry_after and retries the frozen batch without losing new reports', async () => {
        status = 429
        body = { ok: false, parameters: { retry_after: 60 } }
        await accept(report(1))
        await tick(start + 1)
        expect(await alarmTime()).toBe(start + 60_001)
        await accept(report(2))
        expect(await alarmTime()).toBe(start + 60_001)
        status = 200
        body = { ok: true }
        await tick(start + 60_001)
        expect(messages[1].text).toBe(messages[0].text)
        await tick(start + 60_002)
        expect(messages).toHaveLength(3)
    })

    it('bounds retries, expires stale reports, and eventually cleans retained state', async () => {
        status = 503
        body = { ok: false }
        await accept(report(1))
        await tick(start + 1)
        await tick(start + 1 + policy.creditRefillMs)
        await tick(start + 1 + 2 * policy.creditRefillMs)
        expect(messages).toHaveLength(3)
        await tick(start + policy.retentionMs + 1)
        expect(await alarmTime()).toBeNull()
        vi.setSystemTime(start + policy.retentionMs + 2)
        await accept({ ...report(2), report: { ...report(2).report, timestamp: new Date(start).toISOString() } })
        expect(await alarmTime()).toBeNull()
    })

    it('honours retry_after when Telegram requests more than ten minutes', async () => {
        status = 429
        body = { ok: false, parameters: { retry_after: 900 } }
        await accept(report(1))
        await tick(start + 1)
        expect(await alarmTime()).toBe(start + 900_001)
        await tick(start + 1 + policy.creditRefillMs)
        expect(messages).toHaveLength(1)
        status = 200
        body = { ok: true }
        await tick(start + 900_001)
        expect(messages).toHaveLength(2)
    })

    it('spends credits on ambiguous timeouts so retries cannot bypass the budget', async () => {
        await accept(report(1))
        const originalFetch = globalThis.fetch
        let attempts = 0
        const failing = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
            if (String(input).includes('api.telegram.org')) {
                attempts++
                throw new Error('simulated timeout')
            }
            return originalFetch(input, init)
        })
        await tick(start + 1)
        await tick(start + 1 + policy.retryDelayMs)
        await tick(start + 1 + 3 * policy.retryDelayMs)
        expect(attempts).toBe(3)
        failing.mockImplementation(originalFetch)
        await accept(report(2))
        expect(await alarmTime()).toBe(start + 1 + policy.creditRefillMs)
        await tick(start + policy.creditRefillMs)
        expect(messages).toHaveLength(0)
        await tick(start + 1 + policy.creditRefillMs)
        expect(messages).toHaveLength(1)
    })

    it('does not deliver a batch after its freshness deadline', async () => {
        await accept(report(1))
        status = 429
        body = { ok: false, parameters: { retry_after: 3600 } }
        await tick(start + 1)
        expect(await alarmTime()).toBe(start + policy.maxReportAgeMs)
        await tick(start + policy.maxReportAgeMs)
        expect(messages).toHaveLength(1)
    })

    it('preserves chat cooldown after an expired batch, including for new reports', async () => {
        await accept(report(1))
        status = 429
        body = { ok: false, parameters: { retry_after: 3600 } }
        await tick(start + 1)
        await tick(start + policy.maxReportAgeMs)
        vi.setSystemTime(start + policy.maxReportAgeMs + 1)
        await accept(report(2))
        await tick(Date.now() + 1)
        expect(messages).toHaveLength(1)
        expect(await alarmTime()).toBe(start + 3_600_001)
    })

    it('keeps a digest to the top five stations and escapes transit names', async () => {
        for (let id = 1; id <= 7; id++) {
            await accept({
                ...report(id),
                report: { ...report(id).report, stationId: `station-${id}`, lineId: null, directionId: null },
            })
        }
        await tick(start + policy.creditRefillMs)
        expect(messages).toHaveLength(1)
        expect(messages[0].text).toContain('7 neue Meldungen an 7 Stationen')
        expect(messages[0].text).toContain('Stop &amp; &lt;1&gt;')
        expect(messages[0].text).not.toContain('Stop &amp; &lt;6&gt;')
        expect(String(messages[0].text).length).toBeLessThan(4096)
    })

    it.each([200, 400, 403])('does not retry permanent Telegram rejections (%s)', async (code) => {
        status = code
        body = { ok: false, description: 'Failure for 1:test-secret' }
        await accept(report(1))
        await tick(start + 1)
        await tick(start + 60_000)
        expect(messages).toHaveLength(1)
    })

    it('rejects invalid events and missing credentials, and ignores disabled cities, echoes and development', async () => {
        await expect(accept({ ...report(1), city: 'unknown' })).rejects.toBeInstanceOf(Error)
        await expect(accept({ ...report(1), chatId: 'arbitrary' })).rejects.toBeInstanceOf(Error)
        await expect(accept(report(1), { TELEGRAM_BOT_TOKEN: undefined })).rejects.toBeInstanceOf(Error)
        await accept({ ...report(1), report: { ...report(1).report, source: 'telegram' } })
        await accept(report(1, 'hamburg'))
        await accept(report(1), { NODE_ENV: 'development' })
        expect(await alarmTime()).toBeNull()
        expect(messages).toHaveLength(0)
    })

    it('does not send unknown transit references', async () => {
        await accept({ ...report(1), report: { ...report(1).report, stationId: 'missing' } })
        await tick(start + 1)
        expect(messages).toHaveLength(0)
    })
})
