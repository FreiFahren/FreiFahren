import { env, fetchMock } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { handleReportForward } from '../src/forwarding'
import type { Env } from '../src/types'
import { ALLOWED_CHAT_ID, makeIndex, pickStationFixture, rawTransit } from './fixtures'

const testEnv = env as unknown as Env
const index = makeIndex()
const picked = pickStationFixture(index)

function interceptTransit() {
    const { rawStations, rawLines } = rawTransit()
    fetchMock
        .get('https://backend.test')
        .intercept({ path: '/v0/transit/stations?city=berlin', method: 'GET' })
        .reply(200, JSON.stringify(rawStations), { headers: { 'content-type': 'application/json' } })
    fetchMock
        .get('https://backend.test')
        .intercept({ path: '/v0/transit/lines?city=berlin', method: 'GET' })
        .reply(200, JSON.stringify(rawLines), { headers: { 'content-type': 'application/json' } })
}

function interceptTelegram(statusCode: number, capture?: { body?: Record<string, unknown> }) {
    fetchMock
        .get('https://api.telegram.org')
        .intercept({ path: /\/bot.*\/sendMessage/, method: 'POST' })
        .reply((opts) => {
            if (capture) capture.body = JSON.parse(opts.body as string)
            return { statusCode, data: statusCode === 200 ? '{"ok":true}' : '{"ok":false}' }
        })
}

function reportRequest(body: unknown, password: string | null = 'password'): Request {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (password !== null) headers['X-Password'] = password
    return new Request('https://worker.test/report?city=berlin', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    })
}

beforeEach(() => {
    fetchMock.activate()
    fetchMock.disableNetConnect()
})

afterEach(() => {
    fetchMock.assertNoPendingInterceptors()
})

describe('handleReportForward', () => {
    it('sends a Telegram message for a valid request', async () => {
        interceptTransit()
        const capture: { body?: Record<string, unknown> } = {}
        interceptTelegram(200, capture)

        const res = await handleReportForward(
            reportRequest({
                stationId: picked.stationId,
                lineId: picked.lineId,
                directionId: picked.directionId,
            }),
            testEnv,
        )

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ status: 'success' })
        expect(capture.body?.chat_id).toBe(ALLOWED_CHAT_ID)

        const text = capture.body!.text as string
        expect(text).toContain(index.stations[picked.stationId].name)
        expect(text).toContain(picked.lineName)
        expect(text).toContain(index.stations[picked.directionId].name)
        expect(text).toContain(`/station/${picked.stationId}?utm_source=telegram`)
        expect(text).toContain('utm_medium=bot')
    })

    it('skips writing to a disabled city without affecting request validation', async () => {
        const disabledEnv: Env = { ...testEnv, TELEGRAM_WRITING_DISABLED_CITIES: 'leipzig, berlin' }

        const res = await handleReportForward(
            reportRequest({
                stationId: picked.stationId,
                lineId: picked.lineId,
                directionId: picked.directionId,
            }),
            disabledEnv,
        )

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ status: 'skipped' })
    })

    it('rejects a request with no password (401)', async () => {
        const res = await handleReportForward(
            reportRequest({ stationId: picked.stationId, lineId: picked.lineId, directionId: picked.directionId }, null),
            testEnv,
        )
        expect(res.status).toBe(401)
    })

    it('rejects a wrong password (401)', async () => {
        const res = await handleReportForward(
            reportRequest(
                { stationId: picked.stationId, lineId: picked.lineId, directionId: picked.directionId },
                'totally-wrong',
            ),
            testEnv,
        )
        expect(res.status).toBe(401)
    })

    it.each([
        ['missing_station', { lineId: null, directionId: null }],
        ['missing_direction_key', { lineId: null, stationId: 'x' }],
        ['empty_station_id', { lineId: null, stationId: '', directionId: null }],
        ['extra_key', { lineId: null, stationId: 'x', directionId: null, extra: 1 }],
        ['wrong_type_line', { lineId: 123, stationId: 'x', directionId: null }],
        ['wrong_type_direction', { lineId: null, stationId: 'x', directionId: 5 }],
    ])('returns 400 for schema violation: %s', async (_label, body) => {
        // Schema is validated before any transit fetch, so no interceptor is needed.
        const res = await handleReportForward(reportRequest(body), testEnv)
        expect(res.status).toBe(400)
    })

    it('returns 400 for an unknown stationId', async () => {
        interceptTransit()
        const res = await handleReportForward(
            reportRequest({ lineId: null, stationId: 'DOES_NOT_EXIST', directionId: null }),
            testEnv,
        )
        expect(res.status).toBe(400)
        expect(((await res.json()) as { error: string }).error).toBe('bad_request')
    })

    it('returns 400 for an unknown lineId', async () => {
        interceptTransit()
        const res = await handleReportForward(
            reportRequest({ lineId: 'NO_SUCH_LINE', stationId: picked.stationId, directionId: null }),
            testEnv,
        )
        expect(res.status).toBe(400)
        expect(((await res.json()) as { error: string }).error).toBe('bad_request')
    })

    it('returns 400 for an unknown directionId', async () => {
        interceptTransit()
        const res = await handleReportForward(
            reportRequest({ lineId: picked.lineId, stationId: picked.stationId, directionId: 'DOES_NOT_EXIST' }),
            testEnv,
        )
        expect(res.status).toBe(400)
        expect(((await res.json()) as { error: string }).error).toBe('bad_request')
    })

    it('returns 400 when the line does not serve the direction', async () => {
        interceptTransit()
        // Both stations exist, but the direction sits on a different line than the reported one.
        const line = index.variants.find((v) => v.id === picked.lineId)!
        const foreignDirection = Object.keys(index.stations).find((id) => !line.stations.includes(id))
        expect(foreignDirection).toBeDefined()
        const res = await handleReportForward(
            reportRequest({ lineId: picked.lineId, stationId: picked.stationId, directionId: foreignDirection }),
            testEnv,
        )
        expect(res.status).toBe(400)
    })

    it('returns 400 when the line does not serve the station', async () => {
        interceptTransit()
        const badLine = index.variants.find((v) => !v.stations.includes(picked.stationId))
        expect(badLine).toBeDefined()
        const res = await handleReportForward(
            reportRequest({ lineId: badLine!.id, stationId: picked.stationId, directionId: null }),
            testEnv,
        )
        expect(res.status).toBe(400)
    })

    it('HTML-escapes station names so they cannot inject Telegram markup', async () => {
        const rawStations = {
            'U-evil': { name: `<script>alert('x') & "quotes"</script>`, lines: ['U1'] },
            'U-end': { name: 'End > Start', lines: ['U1'] },
        }
        const rawLines = [{ id: 'U1-v', name: 'U1', isCircular: false, stations: ['U-evil', 'U-end'] }]
        fetchMock
            .get('https://backend.test')
            .intercept({ path: '/v0/transit/stations?city=berlin', method: 'GET' })
            .reply(200, JSON.stringify(rawStations), { headers: { 'content-type': 'application/json' } })
        fetchMock
            .get('https://backend.test')
            .intercept({ path: '/v0/transit/lines?city=berlin', method: 'GET' })
            .reply(200, JSON.stringify(rawLines), { headers: { 'content-type': 'application/json' } })
        const capture: { body?: Record<string, unknown> } = {}
        interceptTelegram(200, capture)

        const res = await handleReportForward(
            reportRequest({ stationId: 'U-evil', lineId: 'U1-v', directionId: 'U-end' }),
            testEnv,
        )

        expect(res.status).toBe(200)
        const text = capture.body!.text as string
        // The message is sent with parse_mode HTML, so raw <, >, &, and quotes in
        // station names would be interpreted as markup (or break parsing) by Telegram.
        expect(text).toContain('&lt;script&gt;alert(&#x27;x&#x27;) &amp; &quot;quotes&quot;&lt;/script&gt;')
        expect(text).not.toContain('<script>')
        expect(text).toContain('End &gt; Start')
    })

    it('returns 502 when the Telegram send fails', async () => {
        interceptTransit()
        interceptTelegram(500)
        const res = await handleReportForward(
            reportRequest({
                stationId: picked.stationId,
                lineId: picked.lineId,
                directionId: picked.directionId,
            }),
            testEnv,
        )
        expect(res.status).toBe(502)
    })
})
