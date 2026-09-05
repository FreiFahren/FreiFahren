import { env, fetchMock } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { processMessage } from '../src/pipeline'
import type { Env } from '../src/types'
import { rawTransit } from './fixtures'

const transitFetch = vi.fn<Fetcher['fetch']>()

const testEnv = env as unknown as Env

const withReportApi = (capture?: { body?: Record<string, unknown> }, status = 200): Env => ({
    ...testEnv,
    TRANSIT_API: {
        fetch: transitFetch,
        connect() {
            throw new Error('Unused')
        },
    },
    REPORT_API: {
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
    transitFetch.mockImplementation(async (input) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
        expect(url.searchParams.get('city')).toBe(city)
        if (url.pathname === '/v0/transit/stations') return Response.json(rawStations)
        if (url.pathname === '/v0/transit/lines') return Response.json(rawLines)
        throw new Error('Unexpected transit request')
    })
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
    transitFetch.mockReset().mockRejectedValue(new Error('Unexpected transit read'))
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

        await processMessage('U7 Rudow 2x BOS', withReportApi(capture), 'berlin')

        expect(capture.body?.report).toEqual({
            stationId: 'U-rudow',
            lineId: 'U7-v',
            directionId: null,
        })
        expect(capture.body).toMatchObject({
            city: 'berlin',
        })
    })

    it('drops spam before fetching transit, Mistral, or the backend', async () => {
        // No interceptors registered: any outbound fetch would throw on disableNetConnect.
        await processMessage('ok', withReportApi(), 'berlin')
    })

    it('does not submit when the extraction is empty', async () => {
        interceptTransit()
        interceptMistral(null, null)
        await processMessage('this is fine', withReportApi(), 'berlin')
    })

    it('throws when the backend rejects the report, so the caller reports it', async () => {
        interceptTransit()
        interceptMistral('Rudow', null)

        // A gate 5xx must reject (webhook routes it to reportError); swallowing it here
        // would silently drop reports with no error-rate signal.
        await expect(processMessage('U7 Rudow 2x BOS', withReportApi(undefined, 500), 'berlin')).rejects.toThrow()
    })

    it('submits station-only with explicit null line and direction', async () => {
        interceptTransit()
        interceptMistral('Rudow', null)
        const capture: { body?: Record<string, unknown> } = {}

        await processMessage('Rudow 2x bos', withReportApi(capture), 'berlin')

        expect(capture.body?.report).toEqual({
            stationId: 'U-rudow',
            lineId: null,
            directionId: null,
        })
    })

    it('submits a Leipzig message to the Leipzig city-scoped API', async () => {
        interceptTransit('leipzig')
        interceptMistral('Rudow', null)
        const capture: { body?: Record<string, unknown> } = {}

        await processMessage('Rudow 3k Kontrolle', withReportApi(capture), 'leipzig')

        expect(capture.body).toMatchObject({
            city: 'leipzig',
            report: { stationId: 'U-rudow' },
        })
    })
})
