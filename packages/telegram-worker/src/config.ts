import type { Env } from './types'

// =============================================================================
// City / language profile
//
// THIS IS THE ONLY PLACE with Berlin/German specifics. Extraction logic in
// extractor.ts reads from here and never hardcodes city specifics. To port the
// bot to another city, swap the constants below (and the CITY_NAME var).
// =============================================================================

/** Free-text reminder of the local circular-line name. Empty = no circular line. */
export const CIRCULAR_LINE_ALIAS = 'Ringbahn'

/** Regex recognizing user shorthand for the circular line. Empty = no circular line. */
export const CIRCULAR_LINE_PATTERN = String.raw`(?<![A-Za-z])(?:s[-\s]?)?ring(?:bahn)?`

/**
 * Language-specific letter folding for normalization.
 *
 * Collapse umlauts to their base letter rather than the digraph form: when users
 * type on ASCII keyboards they almost always write "u"/"o"/"a" (sudkreuz, mockern,
 * bulow), not the "ue"/"oe"/"ae" expansion. Mapping to the base letter makes user
 * input line up with normalized station names. ß stays "ss" — the universally
 * typed substitute.
 */
export const LANGUAGE_LETTER_MAP: Record<string, string> = {
    ä: 'a',
    ö: 'o',
    ü: 'u',
    ß: 'ss',
    Ä: 'a',
    Ö: 'o',
    Ü: 'u',
}

/**
 * (pattern, replacement) pairs applied during normalization so user-typed
 * abbreviations match canonical names. German: "str."/"straße" -> "strasse", etc.
 * Patterns run after lowercasing and letter folding, so they target lowercase.
 */
export const LANGUAGE_ABBREVIATIONS: [RegExp, string][] = [
    [/straße/g, 'strasse'],
    [/str\.?(?=\s|$|\/|,|\)|-)/g, 'strasse'],
    [/str$/g, 'strasse'],
    [/\bbhf\.?\b/g, 'bahnhof'],
    [/\bhbf\.?\b/g, 'hauptbahnhof'],
    [/\bpl\.?\b/g, 'platz'],
]

/** Prefixes users write before a station name that aren't part of it ("S Alexanderplatz"). */
export const STATION_NAME_PREFIX_PATTERN = /^(?:bahnhof\s+|bhf\s+|s\s+|u\s+|s-bahn\s+|u-bahn\s+)+/i

/** Words the LLM might emit as a stationName that really refer to platforms/vehicles. */
export const GENERIC_NON_STATION_WORDS: ReadonlySet<string> = new Set([
    'bahnsteig',
    'bahnsteige',
    'bahnhof',
    'gleis',
    'gleise',
    'zug',
    'zuege',
    'ubahn',
    'sbahn',
    'tram',
    'strassenbahn',
    'haltestelle',
    'platform',
    'bus',
    'station',
    'stop',
])

/** Inspector-report vocabulary the prompt highlights to the model. */
export const INSPECTOR_KEYWORDS =
    'Kontrolleur, BVG-Kontrolle, BOS, BW, Blauwesten, Zivilkontrolle, blaue Westen'

/**
 * Few-shot examples appended to the prompt. Tuned to teach disambiguation the model
 * gets wrong: slang names, direction-vs-station, all-clear messages, the implicit-
 * direction case. Kept in the local language since the chat is mixed German/English.
 * Empty string disables few-shot.
 */
export const PROMPT_EXAMPLES = `Message: "U2 alex hab in dem bahnstation gesehen"
{"stationName": "Alex", "directionName": null}

Message: "3x kotti u3 am Gleis"
{"stationName": "Kottbusser Tor", "directionName": null}

Message: "gorli u1/u3 3 Männer"
{"stationName": "Görlitzer Bahnhof", "directionName": null}

Message: "U7 Rathaus Spandau Richt Rudow Höhe sbhf Neukölln 4 Mann BOS"
{"stationName": "Neukölln", "directionName": "Rudow"}

Message: "u 8 wittenau in blauen westen höhe osloer"
{"stationName": "osloer", "directionName": "wittenau"}

Message: "Gesundbrunnen clean on u8"
{"stationName": "Gesundbrunnen", "directionName": null}

Message: "M29 bus moritzplatz"
{"stationName": "Moritzplatz", "directionName": null}

Message: "3 Bos Jacken M29 Anhalter Bahnhof Richtung Hermannplatz"
{"stationName": "Anhalter Bahnhof", "directionName": "Hermannplatz"}

Message: "S3 nach ostbahnof"
{"stationName": null, "directionName": "Ostbahnhof"}

Message: "To Rathaus SPANDAU"
{"stationName": null, "directionName": "Rathaus Spandau"}

Message: "U7 Rathaus Neukölln 3x BOS just got off the train"
{"stationName": "Rathaus Neukölln", "directionName": null}

Message: "U6 Kaiserin Augusta 2x bos"
{"stationName": "Kaiserin-Augusta-Straße", "directionName": null}

Message: "Zoo Richtung Steglitz"
{"stationName": "Zoo", "directionName": "Steglitz"}

Message: "Hi, kann mir wer ein Ticket verkaufen?"
{"stationName": null, "directionName": null}
`

// =============================================================================
// Runtime config (from env bindings) — non-city-specific.
// =============================================================================

export interface RuntimeConfig {
    backendUrl: string
    publicAppUrl: string
    cityName: string
    mistralModel: string
    telegramReportChatId: string
    mistralApiKey: string
    telegramBotToken: string
    reportPassword: string
    telegramWebhookSecret: string
}

function required(env: Env, name: keyof Env): string {
    const value = env[name]
    if (typeof value !== 'string' || value === '') {
        throw new Error(`Missing required env var: ${name}`)
    }
    return value
}

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '')

export function readConfig(env: Env): RuntimeConfig {
    return {
        backendUrl: stripTrailingSlash(required(env, 'BACKEND_URL')),
        publicAppUrl: stripTrailingSlash(env.PUBLIC_APP_URL || 'https://app.freifahren.org'),
        cityName: env.CITY_NAME || 'Berlin',
        mistralModel: env.MISTRAL_MODEL || 'mistral-small-latest',
        telegramReportChatId: required(env, 'TELEGRAM_REPORT_CHAT_ID'),
        mistralApiKey: required(env, 'MISTRAL_API_KEY'),
        telegramBotToken: required(env, 'TELEGRAM_BOT_TOKEN'),
        reportPassword: required(env, 'REPORT_PASSWORD'),
        telegramWebhookSecret: required(env, 'TELEGRAM_WEBHOOK_SECRET'),
    }
}
