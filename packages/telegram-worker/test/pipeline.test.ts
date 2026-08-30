import { env, fetchMock } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { processMessage } from '../src/pipeline'
import type { Env } from '../src/types'
import { rawTransit } from './fixtures'

const testEnv = env as unknown as Env

const withReportGate = (capture?: { body?: Record<string, unknown> }, status = 200): Env => ({
    ...testEnv,
    REPORT_GATE: {
        async intake(body) {
            if (capture !== undefined) capture.body = body as unknown as Record<string, unknown>
            if (status >= 400) {
                return {
                    ok: false,
                    error: { message: 'Rejected', statusCode: status, internalCode: 'UNKNOWN_ERROR' },
                } as const
            }
            return { ok: true, data: {} } as const
        },
    },
})

function interceptTransit(city = 'berlin') {
    const { rawStations, rawLines } = rawTransit()
    fetchMock
        .get('https://backend.test')
        .intercept({ path: `/v0/transit/stations?city=${city}`, method: 'GET' })
        .reply(200, JSON.stringify(rawStations), { headers: { 'content-type': 'application/json' } })
    fetchMock
        .get('https://backend.test')
        .intercept({ path: `/v0/transit/lines?city=${city}`, method: 'GET' })
        .reply(200, JSON.stringify(rawLines), { headers: { 'content-type': 'application/json' } })
}

function interceptMistral(stationName: string | null, directionName: string | null) {
    const body = JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ stationName, directionName }) } }],
    })
    fetchMock
        .get('https://api.mistral.ai')
        .intercept({ path: '/v1/chat/completions', method: 'POST' })
        .reply(200, body, { headers: { 'content-type': 'application/json' } })
}

beforeEach(() => {
    fetchMock.activate()
    fetchMock.disableNetConnect()
})

afterEach(() => {
    fetchMock.assertNoPendingInterceptors()
})

describe('processMessage', () => {
    it('submits a line report with an explicit null direction', async () => {
        interceptTransit()
        interceptMistral('Rudow', null)
        const capture: { body?: Record<string, unknown> } = {}

        await processMessage('U7 Rudow 2x BOS', withReportGate(capture), 'berlin')

        expect(capture.body?.report).toEqual({
            stationId: 'U-rudow',
            source: 'telegram',
            lineId: 'U7-v',
            directionId: null,
        })
        expect(capture.body).toMatchObject({
            city: {
                slug: 'berlin',
                dbBinding: 'DB',
                reporting: { publicSubmissionsEnabled: true, telegramForwardingEnabled: false },
            },
        })
    })

    it('drops spam before fetching transit, Mistral, or the backend', async () => {
        // No interceptors registered: any outbound fetch would throw on disableNetConnect.
        await processMessage('ok', withReportGate(), 'berlin')
    })

    it('does not submit when the extraction is empty', async () => {
        interceptTransit()
        interceptMistral(null, null)
        await processMessage('this is fine', withReportGate(), 'berlin')
    })

    it('throws when the backend rejects the report, so the caller reports it', async () => {
        interceptTransit()
        interceptMistral('Rudow', null)

        // A gate 5xx must reject (webhook routes it to reportError); swallowing it here
        // would silently drop reports with no error-rate signal.
        await expect(processMessage('U7 Rudow 2x BOS', withReportGate(undefined, 500), 'berlin')).rejects.toThrow()
    })

    it('submits station-only with explicit null line and direction', async () => {
        interceptTransit()
        interceptMistral('Rudow', null)
        const capture: { body?: Record<string, unknown> } = {}

        await processMessage('Rudow 2x bos', withReportGate(capture), 'berlin')

        expect(capture.body?.report).toEqual({
            stationId: 'U-rudow',
            source: 'telegram',
            lineId: null,
            directionId: null,
        })
    })

    it('submits a Leipzig message to the Leipzig city-scoped API', async () => {
        interceptTransit('leipzig')
        interceptMistral('Rudow', null)
        const capture: { body?: Record<string, unknown> } = {}

        await processMessage('Rudow 3k Kontrolle', withReportGate(capture), 'leipzig')

        expect(capture.body).toMatchObject({
            city: { slug: 'leipzig', dbBinding: 'DB_LEIPZIG' },
            report: { stationId: 'U-rudow', source: 'telegram' },
        })
    })
})
