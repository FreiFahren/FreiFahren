import * as config from './config'
import { StationNameExtraction, type TransitIndex } from './types'
import { stationLineNames } from './transit'

export interface ExtractionResult {
    stationId: string | null
    lineName: string | null
    directionId: string | null
}

export function isEmpty(result: ExtractionResult): boolean {
    return result.stationId === null && result.lineName === null && result.directionId === null
}

export function extractionToLog(result: ExtractionResult): string {
    return JSON.stringify({
        stationId: result.stationId,
        lineName: result.lineName,
        directionId: result.directionId,
    })
}

function translateLetters(s: string): string {
    return s.replace(/[äöüßÄÖÜ]/g, (c) => config.LANGUAGE_LETTER_MAP[c] ?? c)
}

export function normalizeName(name: string): string {
    let n = name.trim().toLowerCase()
    n = n.replace(config.STATION_NAME_PREFIX_PATTERN, '')
    n = translateLetters(n)
    // Strip any diacritics that survived the letter map.
    n = n.normalize('NFKD').replace(/\p{M}/gu, '')
    for (const [pattern, repl] of config.LANGUAGE_ABBREVIATIONS) {
        n = n.replace(pattern, repl)
    }
    n = n.replace(/[^a-z0-9]+/g, '')
    return n
}

// Faithful port of CPython's difflib.SequenceMatcher.ratio() (no custom junk; autojunk
// kicks in at len>=200 as upstream). Station names are short, but we keep parity exact.

function buildB2J(b: string): Map<string, number[]> {
    const b2j = new Map<string, number[]>()
    for (let i = 0; i < b.length; i++) {
        const arr = b2j.get(b[i])
        if (arr) arr.push(i)
        else b2j.set(b[i], [i])
    }
    const n = b.length
    if (n >= 200) {
        const ntest = Math.floor(n / 100) + 1
        for (const [elt, idxs] of [...b2j]) {
            if (idxs.length > ntest) b2j.delete(elt)
        }
    }
    return b2j
}

function findLongestMatch(
    a: string,
    b: string,
    b2j: Map<string, number[]>,
    alo: number,
    ahi: number,
    blo: number,
    bhi: number,
): [number, number, number] {
    let besti = alo
    let bestj = blo
    let bestsize = 0
    let j2len = new Map<number, number>()
    for (let i = alo; i < ahi; i++) {
        const newj2len = new Map<number, number>()
        const js = b2j.get(a[i])
        if (js) {
            for (const j of js) {
                if (j < blo) continue
                if (j >= bhi) break
                const k = (j2len.get(j - 1) ?? 0) + 1
                newj2len.set(j, k)
                if (k > bestsize) {
                    besti = i - k + 1
                    bestj = j - k + 1
                    bestsize = k
                }
            }
        }
        j2len = newj2len
    }
    while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) {
        besti--
        bestj--
        bestsize++
    }
    while (besti + bestsize < ahi && bestj + bestsize < bhi && a[besti + bestsize] === b[bestj + bestsize]) {
        bestsize++
    }
    return [besti, bestj, bestsize]
}

function matchingChars(a: string, b: string): number {
    const b2j = buildB2J(b)
    let total = 0
    const queue: [number, number, number, number][] = [[0, a.length, 0, b.length]]
    while (queue.length) {
        const [alo, ahi, blo, bhi] = queue.pop()!
        const [i, j, k] = findLongestMatch(a, b, b2j, alo, ahi, blo, bhi)
        if (k > 0) {
            total += k
            if (alo < i && blo < j) queue.push([alo, i, blo, j])
            if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi])
        }
    }
    return total
}

function ratio(a: string, b: string): number {
    const total = a.length + b.length
    return total ? (2.0 * matchingChars(a, b)) / total : 1.0
}

/** Hybrid score: prefix and substring win first, otherwise difflib ratio. */
function similarity(queryNorm: string, candidateNorm: string): number {
    if (!queryNorm || !candidateNorm) {
        return 0.0
    }
    if (queryNorm === candidateNorm) {
        return 1.0
    }
    if (candidateNorm.startsWith(queryNorm) || queryNorm.startsWith(candidateNorm)) {
        return 0.95
    }
    if (candidateNorm.includes(queryNorm) || queryNorm.includes(candidateNorm)) {
        // Reward containment but cap below prefix; longer overlap relative to candidate scores higher.
        return 0.85 + 0.05 * (queryNorm.length / Math.max(candidateNorm.length, 1))
    }
    return ratio(queryNorm, candidateNorm)
}

/**
 * Score candidate station ids for a free-text query against the index.
 * Two-tier: full-query scoring first, per-word fallback only if no strong match.
 */
function candidates(
    index: TransitIndex,
    query: string,
    lineName: string | null,
    minScore = 0.6,
): [string, number][] {
    const full = normalizeName(query)
    if (!full) {
        return []
    }

    const scored: [string, number][] = []
    for (const candNorm of Object.keys(index.byNorm)) {
        const sc = similarity(full, candNorm)
        if (sc >= minScore) {
            scored.push([candNorm, sc])
        }
    }

    // Tier 2: only if Tier 1 found no strong match, fall back to per-word scoring.
    // Keeps "Rathaus Tiergarten" matchable as "Tiergarten" without letting common
    // tail words ("Markt", "Platz", "Str") hijack longer queries.
    const best = scored.reduce((m, [, sc]) => Math.max(m, sc), 0)
    if (scored.length === 0 || best < 0.75) {
        const wordQueries = query
            .split(/[\s\-/,]+/)
            .filter((p) => p.trim() && p.trim().length > 4)
            .map((p) => normalizeName(p))
            .filter((w) => w && w !== full)
        for (const candNorm of Object.keys(index.byNorm)) {
            for (const w of wordQueries) {
                const sc = similarity(w, candNorm) * 0.9 // slight penalty so full-query wins ties
                if (sc >= minScore) {
                    scored.push([candNorm, sc])
                }
            }
        }
    }

    if (scored.length === 0) {
        return []
    }
    // Stable sort by score descending (matches Python's list.sort stability).
    scored.sort((x, y) => y[1] - x[1])

    const results: [string, number][] = []
    for (const [norm, sc] of scored) {
        for (const stationId of index.byNorm[norm]) {
            if (lineName !== null && !stationLineNames(index, stationId).includes(lineName)) {
                continue
            }
            results.push([stationId, sc])
        }
    }
    return results
}

/**
 * Return [stationId, stationIsOnLine] or null.
 *
 * The bool tells callers whether the picked station is on `lineName`. When the user
 * types a station that isn't on the line they mentioned (e.g. "u6 turmstr" —
 * Turmstraße is on U9), we trust the station and drop the line rather than pick a
 * wrong same-line station with a worse fuzzy score.
 */
export function pickStation(
    index: TransitIndex,
    query: string | null,
    lineName: string | null,
    allowOffLine = true,
): [string, boolean] | null {
    if (!query) {
        return null
    }
    if (config.GENERIC_NON_STATION_WORDS.has(normalizeName(query))) {
        return null
    }
    const onLine = lineName !== null ? candidates(index, query, lineName) : []
    let offLine: [string, number][] = []
    if (allowOffLine && (onLine.length === 0 || (lineName !== null && onLine[0][1] < 0.92))) {
        // Only compare against an unfiltered search when the line-filtered match isn't
        // already near-exact, else we'd risk swapping in a slightly higher off-line station.
        offLine = candidates(index, query, null)
    }

    if (onLine.length === 0 && offLine.length === 0) {
        return null
    }
    if (onLine.length === 0) {
        return [offLine[0][0], false]
    }
    if (offLine.length === 0) {
        return [onLine[0][0], true]
    }
    // If off-line tops on-line by a clear margin, prefer it and drop the line.
    if (offLine[0][1] >= onLine[0][1] + 0.1) {
        return [offLine[0][0], false]
    }
    return [onLine[0][0], true]
}

/**
 * Pick a direction station id, preferring stations on the user's line for
 * disambiguation. Backend handles terminus snapping and same-as-station clearing.
 */
export function pickDirection(
    index: TransitIndex,
    query: string | null,
    lineName: string | null,
): string | null {
    if (!query) {
        return null
    }
    const picked = pickStation(index, query, lineName, lineName === null)
    return picked !== null ? picked[0] : null
}

/**
 * Resolution stage: raw extracted strings + detected line in, station/direction ids out.
 * Kept separate from the LLM so its fuzzy-match edge cases are testable without one.
 */
export function resolveExtraction(
    index: TransitIndex,
    parsed: StationNameExtraction,
    detectedLine: string | null,
): ExtractionResult {
    const picked = pickStation(index, parsed.stationName, detectedLine)
    const stationId = picked !== null ? picked[0] : null
    const stationOnLine = picked !== null ? picked[1] : false

    let lineName = detectedLine
    if (lineName !== null && stationId !== null && !stationOnLine) {
        lineName = null
    }

    return {
        stationId,
        lineName,
        directionId: pickDirection(index, parsed.directionName, lineName),
    }
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const CIRCULAR_LINE_REGEX = config.CIRCULAR_LINE_PATTERN
    ? new RegExp(config.CIRCULAR_LINE_PATTERN, 'i')
    : null

export function buildLinePattern(lineNames: string[]): RegExp {
    const alternatives: string[] = []
    for (const lineName of [...lineNames].sort((a, b) => b.length - a.length)) {
        if (/^\d+$/.test(lineName)) {
            continue
        }
        // Match common chat variants like "U6", "u 6", "M 10" while avoiding words like "Uhr".
        const parts = /^([A-Za-z]+)(\d+)$/.exec(lineName)
        alternatives.push(
            parts ? `${escapeRegex(parts[1])}\\s*${escapeRegex(parts[2])}` : escapeRegex(lineName),
        )
    }
    return new RegExp(`(?<![A-Za-z0-9])(${alternatives.join('|')})(?![A-Za-z0-9])`, 'gi')
}

export function detectLineName(
    message: string,
    lineNames: string[],
    linePattern: RegExp,
    circularLineNames: string[] = [],
): string | null {
    const normalizedLines = new Map<string, string>()
    for (const lineName of lineNames) {
        normalizedLines.set(lineName.replace(/\s+/g, '').toUpperCase(), lineName)
    }
    for (const match of message.matchAll(linePattern)) {
        const normalizedMatch = match[1].replace(/\s+/g, '').toUpperCase()
        const hit = normalizedLines.get(normalizedMatch)
        if (hit !== undefined) {
            return hit
        }
    }
    if (circularLineNames.length > 0 && CIRCULAR_LINE_REGEX !== null && CIRCULAR_LINE_REGEX.test(message)) {
        return circularLineNames[0]
    }
    return null
}

export function buildSystemPrompt(index: TransitIndex, cityName: string): string {
    const tracked = [...index.lineNames].sort().join(', ')
    const examples = config.PROMPT_EXAMPLES.trim()
    return (
        `This is a ${cityName} public-transit chat where users report ticket-inspector ` +
        `sightings (${config.INSPECTOR_KEYWORDS}, etc.). Almost every message is a sighting report.\n` +
        '\n' +
        'Respond with ONLY a JSON object — no prose, no markdown — exactly matching this shape:\n' +
        '{"stationName": <string or null>, "directionName": <string or null>}\n' +
        '\n' +
        'Rules:\n' +
        '- Extract from sighting reports. Messages with just a station name, just a line, or vague ' +
        'phrasing like "waiting at X", "got out at X", "now at X", "chilling at X", or "X clean" ' +
        'are reports. Typos, slang, and language mixing are normal.\n' +
        '- For clear non-reports (spam/ads, questions, ticket sales, social chitchat with no ' +
        'location, off-topic banter), set both fields to null.\n' +
        '- stationName: the station the user is currently at. Copy it as written, including typos. ' +
        'If the user gives a CURRENT station and a DIRECTION ("U7 Rathaus Spandau Richtung Rudow ' +
        'höhe Neukölln" / "u8 wittenau höhe osloer"), the CURRENT station is the one near a word ' +
        'like "höhe", "at", "now", "gerade", "jetzt", or simply the LATER one in the sentence. ' +
        "A line's terminus mentioned without \"Richtung\" but at the start of the message is often " +
        'still the direction. Set null if only a line and/or a direction phrase appear, with no ' +
        'current station.\n' +
        '- directionName: the destination after words like "Richtung", "nach", "to", "towards", ' +
        '"->", "bis", "Ri.", or a line\'s well-known terminus mentioned alongside another ' +
        'station ("U7 Rudow ... Neukölln" -> direction Rudow, station Neukölln). NEVER repeat ' +
        'the current station here. Null if no direction is given.\n' +
        `- We track these lines: ${tracked}. Sightings on OTHER lines (local buses M19/M29/M41, ` +
        'X-lines, three-digit lines, etc.) are still reports if a station name is mentioned — ' +
        'extract the station (bus stops are named after the nearby U/S station).\n' +
        '- Never return generic words as a stationName (platform, station, vehicle types). If ' +
        'only generic words appear, set stationName=null.\n' +
        (examples ? `\nExamples:\n${examples}\n` : '')
    )
}

const MISTRAL_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions'
// Bound a hung request so it can't keep the waitUntil task alive indefinitely; a timeout
// surfaces as a thrown error the caller reports.
const MISTRAL_TIMEOUT_MS = 20_000

/**
 * Call Mistral and parse the JSON response. Throws on API failure (network, timeout, 429,
 * 5xx); the caller reports it and the message is dropped (no retry). Returns null on an
 * unparseable/malformed response (a non-report we simply drop).
 */
export async function extractWithMistral(
    message: string,
    systemPrompt: string,
    apiKey: string,
    model: string,
): Promise<StationNameExtraction | null> {
    const response = await fetch(MISTRAL_ENDPOINT, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.0,
        }),
        signal: AbortSignal.timeout(MISTRAL_TIMEOUT_MS),
    })

    if (!response.ok) {
        throw new Error(`Mistral API error: ${response.status} ${await response.text()}`)
    }

    const data = (await response.json()) as {
        choices?: { message?: { content?: unknown } }[]
    }
    const raw = data.choices?.[0]?.message?.content
    if (typeof raw !== 'string') {
        return null
    }

    try {
        return StationNameExtraction.parse(JSON.parse(raw))
    } catch {
        return null
    }
}
