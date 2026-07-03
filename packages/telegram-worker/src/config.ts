import { getCity } from '@freifahren/cities'

import type { Env } from './types'

// German language normalization. Shared by every German-speaking city, so kept here
// rather than in the per-city registry; city-specific data comes from packages/cities
// via profileFor() below. Umlauts fold to their base letter, not the digraph, because
// on ASCII keyboards users type "u"/"o"/"a" (sudkreuz, mockern), not "ue"/"oe"/"ae".
const GERMAN_LETTER_MAP: Record<string, string> = {
    ä: 'a',
    ö: 'o',
    ü: 'u',
    ß: 'ss',
    Ä: 'a',
    Ö: 'o',
    Ü: 'u',
}

// Leading prefixes users type that aren't part of the station name ("S Alexanderplatz").
const GERMAN_STATION_NAME_PREFIX_PATTERN = /^(?:bahnhof\s+|bhf\s+|s\s+|u\s+|s-bahn\s+|u-bahn\s+)+/i

// Words that are never a station name on their own (platforms, vehicle types).
const GERMAN_GENERIC_NON_STATION_WORDS: ReadonlySet<string> = new Set([
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

/**
 * Everything the extractor needs, resolved once per run: the German constants above
 * plus the city's registry profile (see CityTelegramProfile in packages/cities), with
 * its regex sources compiled here.
 */
export interface CityProfile {
    displayName: string
    letterMap: Record<string, string>
    stationNamePrefixPattern: RegExp
    genericNonStationWords: ReadonlySet<string>
    abbreviations: [RegExp, string][]
    /** null when the city has no circular line. */
    circularLineRegex: RegExp | null
    inspectorKeywords: string
    promptExamples: string
}

// Throws on an unknown city so a misconfigured deployment fails loudly rather than
// silently prompting the model with the wrong city's examples.
export function profileFor(cityName: string): CityProfile {
    const city = getCity(cityName.toLowerCase())
    if (!city) {
        throw new Error(`No city registry entry for CITY_NAME="${cityName}"`)
    }
    const { telegram } = city
    return {
        displayName: city.displayName,
        letterMap: GERMAN_LETTER_MAP,
        stationNamePrefixPattern: GERMAN_STATION_NAME_PREFIX_PATTERN,
        genericNonStationWords: GERMAN_GENERIC_NON_STATION_WORDS,
        abbreviations: telegram.abbreviations.map(
            ([pattern, replacement]): [RegExp, string] => [new RegExp(pattern, 'g'), replacement],
        ),
        circularLineRegex: telegram.circularLinePattern
            ? new RegExp(telegram.circularLinePattern, 'i')
            : null,
        inspectorKeywords: telegram.inspectorKeywords,
        promptExamples: telegram.promptExamples,
    }
}

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
