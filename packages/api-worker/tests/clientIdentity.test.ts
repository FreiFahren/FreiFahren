import { desc, eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { normalizeUserAgent, SALT_PERIOD_MS } from '../src/modules/reports/client-identity'

import { db, lineStations, lines, reports } from './test-db'
import { appRequestWithRedirect, resetTestEnv, setSystemTime, setTestEnv, testEnv } from './test-utils'

const SECRET = 'test-client-hash-secret'

let stationId: string

// `cf` is what Cloudflare attaches at the edge and workerd honours it in RequestInit, so a test can
// place a request on a named network without reaching past the public surface.
const postReport = ({
    headers = {},
    cf,
    body,
}: { headers?: Record<string, string>; cf?: Record<string, unknown>; body?: object } = {}) =>
    appRequestWithRedirect('/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        ...(cf === undefined ? {} : { cf }),
        body: JSON.stringify(body ?? { stationId, source: 'web_app' }),
    })

// The row the request under test just wrote. Attribution is deliberately absent from the response
// body, so the stored row is the only place it can be observed.
const lastStoredReport = async () => {
    const [row] = await db
        .select({
            asn: reports.asn,
            asOrganization: reports.asOrganization,
            uaFamily: reports.uaFamily,
            clientHash: reports.clientHash,
            source: reports.source,
        })
        .from(reports)
        .orderBy(desc(reports.reportId))
        .limit(1)
    return row!
}

const VODAFONE = { asn: 3209, asOrganization: 'Vodafone GmbH' }
const CHROME_ANDROID =
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'

beforeAll(async () => {
    const [line] = await db.select({ id: lines.id }).from(lines).limit(1)
    const [station] = await db
        .select({ id: lineStations.stationId })
        .from(lineStations)
        .where(eq(lineStations.lineId, line!.id))
        .limit(1)
    stationId = station!.id
})

beforeEach(() => {
    setTestEnv({ CLIENT_HASH_SECRET: SECRET, REPORTING_ENABLED: 'true' })
})

afterEach(() => {
    resetTestEnv()
    setSystemTime()
})

describe('client attribution on report intake', () => {
    it('records the network, the user agent family and a client hash', async () => {
        const response = await postReport({
            headers: { 'User-Agent': CHROME_ANDROID, 'CF-Connecting-IP': '203.0.113.7' },
            cf: VODAFONE,
        })
        expect(response.status).toBe(200)

        const stored = await lastStoredReport()
        expect(stored.asn).toBe(3209)
        expect(stored.asOrganization).toBe('Vodafone GmbH')
        expect(stored.uaFamily).toBe('Chrome/140 Android')
        expect(stored.clientHash).toMatch(/^[0-9a-f]{32}$/)
    })

    it('stores no attribution while CLIENT_HASH_SECRET is unset', async () => {
        setTestEnv({ CLIENT_HASH_SECRET: undefined })

        const response = await postReport({
            headers: { 'User-Agent': CHROME_ANDROID, 'CF-Connecting-IP': '203.0.113.7' },
            cf: VODAFONE,
        })
        expect(response.status).toBe(200)

        const stored = await lastStoredReport()
        expect(stored).toMatchObject({ asn: null, asOrganization: null, uaFamily: null, clientHash: null })
    })

    // The relay hop describes telegram-worker, not a reporter, so attributing it would record
    // something true about the wrong party.
    it('stores no attribution for reports relayed with the shared worker secret', async () => {
        const response = await postReport({
            headers: {
                'User-Agent': CHROME_ANDROID,
                'CF-Connecting-IP': '203.0.113.7',
                'X-Password': testEnv().REPORT_PASSWORD ?? '',
            },
            cf: VODAFONE,
            body: { stationId, source: 'telegram' },
        })
        expect(response.status).toBe(200)

        const stored = await lastStoredReport()
        expect(stored).toMatchObject({ asn: null, uaFamily: null, clientHash: null })
    })

    // `source` is caller-supplied, so claiming 'telegram' must not be a way to shed attribution.
    it('still attributes a report that claims to be telegram-sourced without the secret', async () => {
        const response = await postReport({
            headers: { 'User-Agent': CHROME_ANDROID, 'CF-Connecting-IP': '203.0.113.7' },
            cf: VODAFONE,
            body: { stationId, source: 'telegram' },
        })
        expect(response.status).toBe(200)

        const stored = await lastStoredReport()
        expect(stored.clientHash).toMatch(/^[0-9a-f]{32}$/)
        expect(stored.asn).toBe(3209)
    })

    it('ignores attribution supplied in the request body', async () => {
        const response = await postReport({
            headers: { 'User-Agent': CHROME_ANDROID, 'CF-Connecting-IP': '203.0.113.7' },
            cf: VODAFONE,
            body: { stationId, source: 'web_app', asn: 64496, uaFamily: 'spoofed', clientHash: 'deadbeef' },
        })
        expect(response.status).toBe(200)

        const stored = await lastStoredReport()
        expect(stored.asn).toBe(3209)
        expect(stored.uaFamily).toBe('Chrome/140 Android')
        expect(stored.clientHash).not.toBe('deadbeef')
    })
})

describe('client hash identity', () => {
    const hashFor = async (headers: Record<string, string>, cf = VODAFONE) => {
        await postReport({ headers, cf })
        return (await lastStoredReport()).clientHash
    }

    it('is stable for the same address and user agent', async () => {
        const first = await hashFor({ 'User-Agent': CHROME_ANDROID, 'CF-Connecting-IP': '203.0.113.7' })
        const second = await hashFor({ 'User-Agent': CHROME_ANDROID, 'CF-Connecting-IP': '203.0.113.7' })
        expect(second).toBe(first)
    })

    it('differs when the user agent is rotated from the same address', async () => {
        const first = await hashFor({ 'User-Agent': CHROME_ANDROID, 'CF-Connecting-IP': '203.0.113.7' })
        const second = await hashFor({
            'User-Agent': CHROME_ANDROID.replace('Chrome/140', 'Chrome/139'),
            'CF-Connecting-IP': '203.0.113.7',
        })
        expect(second).not.toBe(first)
    })

    it('differs when the address changes for the same user agent', async () => {
        const first = await hashFor({ 'User-Agent': CHROME_ANDROID, 'CF-Connecting-IP': '203.0.113.7' })
        const second = await hashFor({ 'User-Agent': CHROME_ANDROID, 'CF-Connecting-IP': '203.0.113.8' })
        expect(second).not.toBe(first)
    })

    // The rotation is what stops the hash linking reports indefinitely, so it has to actually roll.
    it('stops matching once the salt period rolls over', async () => {
        const headers = { 'User-Agent': CHROME_ANDROID, 'CF-Connecting-IP': '203.0.113.7' }

        setSystemTime(new Date('2026-08-07T12:00:00Z'))
        const before = await hashFor(headers)

        setSystemTime(new Date(new Date('2026-08-07T12:00:00Z').getTime() + SALT_PERIOD_MS))
        const after = await hashFor(headers)

        expect(after).not.toBe(before)
    })
})

describe('normalizeUserAgent', () => {
    it.each([
        [CHROME_ANDROID, 'Chrome/140 Android'],
        [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
            'Safari/18 iOS',
        ],
        [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1',
            'Chrome/140 iOS',
        ],
        [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
            'Edge/140 Windows',
        ],
        ['Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0', 'Firefox/130 Linux'],
    ])('maps a real browser agent to its family', (userAgent, expected) => {
        expect(normalizeUserAgent(userAgent)).toBe(expected)
    })

    // These are the high-signal cases: a report filed by one of these is not someone on a platform.
    it.each([
        [
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.0.0 Safari/537.36',
            'HeadlessChrome/140',
        ],
        ['python-requests/2.32.3', 'python'],
        ['curl/8.7.1', 'curl'],
        ['node-fetch/1.0 (+https://github.com/bitinn/node-fetch)', 'node'],
        ['Go-http-client/2.0', 'go'],
    ])('names a non-browser client', (userAgent, expected) => {
        expect(normalizeUserAgent(userAgent)).toBe(expected)
    })

    /*
     * Our own iOS app. Before this was recognised the first native report in production came back as
     * `other iOS`, which is also where an agent claiming to be an iPhone without naming a known
     * browser lands — so the app we ship and something imitating it were indistinguishable.
     */
    it('names the native app WebView rather than leaving it unrecognised', () => {
        const wkWebView =
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
        expect(normalizeUserAgent(wkWebView)).toBe('WKWebView iOS')
    })

    // The WebView is recognised by the absence of `Safari`, so the agents that do carry it must not
    // be caught by the same test.
    it.each([
        [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
            'Safari/18 iOS',
        ],
        [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/150.0.7871.113 Mobile/15E148 Safari/604.1',
            'Chrome/150 iOS',
        ],
    ])('still names an iOS browser that carries Safari', (userAgent, expected) => {
        expect(normalizeUserAgent(userAgent)).toBe(expected)
    })

    it('reports a missing user agent distinctly from an unrecognised one', () => {
        expect(normalizeUserAgent(undefined)).toBe('none')
        expect(normalizeUserAgent('')).toBe('none')
        expect(normalizeUserAgent('Something entirely unfamiliar')).toBe('other')
    })

    // The column is written from the tables in the module, never copied from the header, so a
    // crafted agent cannot widen it or smuggle a fingerprint through.
    it('keeps output bounded for a hostile user agent', () => {
        const hostile = `Chrome/140 ${'A'.repeat(5000)}`
        expect(normalizeUserAgent(hostile).length).toBeLessThanOrEqual(32)
    })
})
