import { env, fetchMock } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { processMessage } from '../src/pipeline'
import type { Env } from '../src/types'
import { rawTransit } from './fixtures'

const testEnv = env as unknown as Env

function interceptTransit() {
    const { rawStations, rawLines } = rawTransit()
    fetchMock
        .get('https://backend.test')
        .intercept({ path: '/v0/transit/stations', method: 'GET' })
        .reply(200, JSON.stringify(rawStations), { headers: { 'content-type': 'application/json' } })
    fetchMock
        .get('https://backend.test')
        .intercept({ path: '/v0/transit/lines', method: 'GET' })
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

function interceptBackendReport(capture: { body?: Record<string, unknown> }) {
    fetchMock
        .get('https://backend.test')
        .intercept({ path: '/v0/reports', method: 'POST' })
        .reply((opts) => {
            capture.body = JSON.parse(opts.body as string)
            return { statusCode: 200, data: '{}' }
        })
}

beforeEach(() => {
    fetchMock.activate()
    fetchMock.disableNetConnect()
})

afterEach(() => {
    fetchMock.assertNoPendingInterceptors()
})

describe('processMessage', () => {
    it('submits a full report (station + line + direction resolution)', async () => {
        interceptTransit()
        interceptMistral('Rudow', null)
        const capture: { body?: Record<string, unknown> } = {}
        interceptBackendReport(capture)

        await processMessage('U7 Rudow 2x BOS', testEnv)

        expect(capture.body).toEqual({ stationId: 'U-rudow', source: 'telegram', lineId: 'U7-v' })
    })

    it('drops spam before fetching transit, Mistral, or the backend', async () => {
        // No interceptors registered: any outbound fetch would throw on disableNetConnect.
        await processMessage('ok', testEnv)
    })

    it('does not submit when the extraction is empty', async () => {
        interceptTransit()
        interceptMistral(null, null)
        await processMessage('this is fine', testEnv)
    })

    it('submits station-only with no lineId/directionId', async () => {
        interceptTransit()
        interceptMistral('Rudow', null)
        const capture: { body?: Record<string, unknown> } = {}
        interceptBackendReport(capture)

        await processMessage('Rudow 2x bos', testEnv)

        expect(capture.body).toEqual({ stationId: 'U-rudow', source: 'telegram' })
    })
})
