/// <reference types="@cloudflare/workers-types" />
import type { Context } from 'hono'

import type { Env } from '../../app-env'

/*
 * What we retain about the client that filed a report, for telling coordinated submission apart
 * from a busy afternoon. Derived here and passed to the insert as its own argument — it is
 * deliberately not part of the request-body schema, so a caller cannot label itself.
 *
 * All four are null together when CLIENT_HASH_SECRET is unset (dev, previews, tests that do not
 * opt in) and for telegram-relayed reports, which reach us server-to-server with no browser
 * behind them.
 */
export type ClientIdentity = {
    asn: number | null
    asOrganization: string | null
    uaFamily: string | null
    clientHash: string | null
}

export const ANONYMOUS_CLIENT: ClientIdentity = {
    asn: null,
    asOrganization: null,
    uaFamily: null,
    clientHash: null,
}

/*
 * The salt rotates, so a client_hash stops matching once the period ends. That bounds how long a
 * report stays linkable to the ones around it, and it also means any quarantine keyed on the hash
 * expires on its own rather than becoming permanent through inattention.
 *
 * A week is long enough to cover an incident and short enough that the linkage does not outlive
 * the reason it was collected.
 */
export const SALT_PERIOD_MS = 7 * 24 * 60 * 60 * 1000

export const saltPeriod = (now: number): number => Math.floor(now / SALT_PERIOD_MS)

/*
 * Non-browser clients announce themselves. Matched before the browser table because these are the
 * high-signal cases — a report filed by curl or headless Chrome is not someone on a platform.
 */
const TOOL_PATTERNS: Array<[RegExp, string]> = [
    [/HeadlessChrome\/(\d+)/, 'HeadlessChrome'],
    [/(?:python-requests|aiohttp|httpx)/i, 'python'],
    [/curl\//i, 'curl'],
    [/Wget\//i, 'wget'],
    [/node-fetch|undici|axios/i, 'node'],
    [/Go-http-client/i, 'go'],
    [/okhttp/i, 'okhttp'],
    [/PostmanRuntime/i, 'postman'],
    [/(?:bot|crawler|spider)/i, 'bot'],
]

// Order matters: every Chromium fork also says "Chrome", and Chrome on iOS also says "Safari".
const BROWSER_PATTERNS: Array<[RegExp, string]> = [
    [/Edg(?:iOS|A)?\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/SamsungBrowser\/(\d+)/, 'Samsung'],
    [/(?:Firefox|FxiOS)\/(\d+)/, 'Firefox'],
    [/CriOS\/(\d+)/, 'Chrome'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/Version\/(\d+)[^)]*Safari/, 'Safari'],
]

// Android must precede Linux: an Android UA also carries "Linux".
const PLATFORM_PATTERNS: Array<[RegExp, string]> = [
    [/Android/, 'Android'],
    [/iPhone|iPad|iPod/, 'iOS'],
    [/Mac OS X/, 'macOS'],
    [/Windows/, 'Windows'],
    [/Linux|X11/, 'Linux'],
]

const firstMatch = (ua: string, patterns: Array<[RegExp, string]>): { name: string; version?: string } | undefined => {
    for (const [pattern, name] of patterns) {
        const match = pattern.exec(ua)
        if (match !== null) return { name, version: match[1] }
    }
    return undefined
}

/*
 * Collapse a User-Agent to a bounded vocabulary: a name, a major version, and a platform. The
 * output is assembled from the tables above rather than copied out of the header, so a crafted
 * User-Agent cannot smuggle unbounded text — or a high-entropy fingerprint — into the column.
 */
export const normalizeUserAgent = (userAgent: string | undefined): string => {
    if (userAgent === undefined || userAgent.trim() === '') return 'none'

    const tool = firstMatch(userAgent, TOOL_PATTERNS)
    if (tool !== undefined) {
        return tool.version === undefined ? tool.name : `${tool.name}/${tool.version}`
    }

    const browser = firstMatch(userAgent, BROWSER_PATTERNS)
    const platform = firstMatch(userAgent, PLATFORM_PATTERNS)
    if (browser === undefined) return platform === undefined ? 'other' : `other ${platform.name}`

    const version = browser.version === undefined ? '' : `/${browser.version}`
    return platform === undefined ? `${browser.name}${version}` : `${browser.name}${version} ${platform.name}`
}

/*
 * Imported keys are reused across requests in an isolate: the derivation is pure and the key never
 * leaves the isolate, so re-importing it per report would be wasted work.
 */
const keyCache = new Map<string, Promise<CryptoKey>>()

const hmacKey = (secret: string): Promise<CryptoKey> => {
    const cached = keyCache.get(secret)
    if (cached !== undefined) return cached
    const key = crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )
    keyCache.set(secret, key)
    return key
}

const toHex = (buffer: ArrayBuffer, characters: number): string => {
    const bytes = new Uint8Array(buffer)
    let out = ''
    for (let i = 0; i < bytes.length && out.length < characters; i++) {
        out += bytes[i]!.toString(16).padStart(2, '0')
    }
    return out.slice(0, characters)
}

/*
 * Half a SHA-256 is 128 bits — far past the point where two clients collide, while keeping the
 * column narrow enough that adding it to every row is not itself a storage decision.
 */
const CLIENT_HASH_CHARACTERS = 32

/*
 * The address is an input and never an output: it is mixed into the HMAC and then discarded, so
 * the row records that two reports came from the same client without recording who that is.
 * Address alone would be too coarse (carrier NAT puts thousands behind one) and User-Agent alone
 * too broad, so the identity is the pair, under the rotating salt.
 */
export const computeClientHash = async (
    secret: string,
    parts: { ip: string; userAgent: string; asn: number | null },
    now: number
): Promise<string> => {
    const key = await hmacKey(secret)
    const message = `${saltPeriod(now)}|${parts.ip}|${parts.userAgent}|${parts.asn ?? ''}`
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
    return toHex(signature, CLIENT_HASH_CHARACTERS)
}

export const resolveClientIdentity = async (
    c: Context<Env>,
    { secret, now = Date.now() }: { secret: string | undefined; now?: number }
): Promise<ClientIdentity> => {
    if (secret === undefined || secret === '') return ANONYMOUS_CLIENT

    // Absent off Cloudflare — the test runner and the seed CLI both call in without a cf object.
    const cf = c.req.raw.cf
    const asn = typeof cf?.asn === 'number' ? cf.asn : null
    const asOrganization = typeof cf?.asOrganization === 'string' ? cf.asOrganization : null

    const userAgent = c.req.header('User-Agent') ?? ''
    const ip = c.req.header('CF-Connecting-IP') ?? ''

    return {
        asn,
        asOrganization,
        uaFamily: normalizeUserAgent(userAgent),
        clientHash: await computeClientHash(secret, { ip, userAgent, asn }, now),
    }
}
