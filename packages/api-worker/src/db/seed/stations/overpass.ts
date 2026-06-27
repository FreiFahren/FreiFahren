import { SEED_CONFIG } from '../config'

export interface OsmNode {
    type: 'node'
    id: number
    lat: number
    lon: number
    tags?: Record<string, string>
}

export interface OsmRelationMember {
    type: 'node' | 'way' | 'relation'
    ref: number
    role: string
}

export interface OsmWayGeometryPoint {
    lat: number
    lon: number
}

export interface OsmWay {
    type: 'way'
    id: number
    nodes?: number[]
    geometry?: OsmWayGeometryPoint[]
    tags?: Record<string, string>
}

export interface OsmRelation {
    type: 'relation'
    id: number
    tags?: Record<string, string>
    members: OsmRelationMember[]
}

export type OsmElement = OsmNode | OsmRelation | OsmWay

const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

/* Overpass etiquette: identify the client. overpass-api.de's nginx returns 406
 * to requests with a generic or missing User-Agent. */
const USER_AGENT = 'FreiFahren-Seed/1.0 (+https://github.com/FreiFahren/FreiFahren)'

const BATCH_SIZE = 10
const BATCH_COOLDOWN_MS = 30_000

const escapeForRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildOperatorRegex = (operators: readonly string[]): string =>
    '^(' + operators.map(escapeForRegex).join('|') + ')$'

const buildRouteTypeRegex = (routeTypes: readonly string[]): string =>
    '^(' + routeTypes.map(escapeForRegex).join('|') + ')$'

const buildRefRegex = (refs: readonly string[]): string => '^(' + refs.map(escapeForRegex).join('|') + ')$'

const chunk = <T>(items: readonly T[], size: number): T[][] => {
    const chunks: T[][] = []
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size) as T[])
    }
    return chunks
}

const buildLineRefsQuery = (): string => {
    const { city, adminLevel, overpass, operators, routeTypes } = SEED_CONFIG
    const operatorRegex = buildOperatorRegex(operators)
    const routeTypeRegex = buildRouteTypeRegex(routeTypes)

    return `
[out:json][timeout:${overpass.timeoutSeconds}];

area["name"="${city}"]["boundary"="administrative"]["admin_level"~"${adminLevel}"]->.a;

relation
  ["type"="route"]
  ["route"~"${routeTypeRegex}"]
  ["operator"~"${operatorRegex}"]
  (area.a);
out tags;
`
}

const buildStationsQuery = (refs: readonly string[]): string => {
    const { city, adminLevel, overpass, operators, routeTypes } = SEED_CONFIG
    const operatorRegex = buildOperatorRegex(operators)
    const routeTypeRegex = buildRouteTypeRegex(routeTypes)
    const refRegex = buildRefRegex(refs)

    return `
[out:json][timeout:${overpass.timeoutSeconds}];

area["name"="${city}"]["boundary"="administrative"]["admin_level"~"${adminLevel}"]->.a;

relation
  ["type"="route"]
  ["route"~"${routeTypeRegex}"]
  ["operator"~"${operatorRegex}"]
  ["ref"~"${refRegex}"]
  (area.a)
  ->.routes;

node(r.routes)->.routeNodes;

rel
  ["public_transport"="stop_area"]
  (bn.routeNodes)
  ->.stopAreas;

node(r.stopAreas)->.stopNodes;

(
  .routes;
  .stopAreas;
  .routeNodes;
  .stopNodes;
);
out body;
`
}

const buildGeometryQuery = (refs: readonly string[]): string => {
    const { city, adminLevel, overpass, operators, routeTypes } = SEED_CONFIG
    const operatorRegex = buildOperatorRegex(operators)
    const routeTypeRegex = buildRouteTypeRegex(routeTypes)
    const refRegex = buildRefRegex(refs)

    return `
[out:json][timeout:${overpass.timeoutSeconds}];

area["name"="${city}"]["boundary"="administrative"]["admin_level"~"${adminLevel}"]->.a;

relation
  ["type"="route"]
  ["route"~"${routeTypeRegex}"]
  ["operator"~"${operatorRegex}"]
  ["ref"~"${refRegex}"]
  (area.a)
  ->.routes;

way(r.routes)->.routeWays;

(
  .routes;
  .routeWays;
);
out geom;
`
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const MAX_RETRIES = 5
const FALLBACK_DELAY_MS = 30_000

/* Parse the plain-text /api/status response and return the shortest "Slot
 * available after: ..., in N seconds." countdown, in ms. Returns null when the
 * endpoint doesn't expose a slot countdown (e.g. kumi). */
const fetchSlotWaitMs = async (endpoint: string): Promise<number | null> => {
    const statusUrl = endpoint.replace(/\/interpreter$/, '/status')
    try {
        const res = await fetch(statusUrl, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) return null
        const text = await res.text()
        const matches = Array.from(text.matchAll(/Slot available after:.*?in (\d+) seconds/g))
        if (matches.length === 0) return null
        const minSeconds = Math.min(...matches.map((m) => Number(m[1])))
        return (minSeconds + 1) * 1000
    } catch {
        return null
    }
}

const mergeServerWait = async (current: number | null, endpoint: string): Promise<number | null> => {
    const wait = await fetchSlotWaitMs(endpoint)
    if (wait === null) return current
    console.log(`[seed:stations]   ${endpoint} status says next slot in ${wait / 1000}s`)
    return Math.max(current ?? 0, wait)
}

const fetchWithRetry = async (query: string, fetchTimeoutMs: number): Promise<OsmElement[]> => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        let serverSuggestedWaitMs: number | null = null

        for (const endpoint of OVERPASS_ENDPOINTS) {
            console.log(`[seed:stations]   Trying ${endpoint} (attempt ${attempt}/${MAX_RETRIES})...`)
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': USER_AGENT,
                    },
                    body: new URLSearchParams({ data: query }),
                    signal: AbortSignal.timeout(fetchTimeoutMs),
                })

                if (response.status === 429 || response.status === 504 || response.status === 406) {
                    console.warn(`[seed:stations]   ${endpoint} returned ${response.status}`)
                    serverSuggestedWaitMs = await mergeServerWait(serverSuggestedWaitMs, endpoint)
                    continue
                }

                if (!response.ok) {
                    console.warn(`[seed:stations]   ${endpoint} returned ${response.status}, trying next...`)
                    continue
                }

                const json = (await response.json()) as { elements: OsmElement[] }
                return json.elements
            } catch (err) {
                console.warn(`[seed:stations]   ${endpoint} failed: ${err instanceof Error ? err.message : err}`)
            }
        }

        if (attempt < MAX_RETRIES) {
            const delay = serverSuggestedWaitMs ?? FALLBACK_DELAY_MS * attempt
            console.log(`[seed:stations]   All endpoints failed, retrying in ${Math.round(delay / 1000)}s...`)
            await sleep(delay)
        }
    }

    throw new Error('All Overpass API endpoints failed after retries')
}

const fetchLineRefs = async (label: string): Promise<string[]> => {
    const { fetchTimeoutMs } = SEED_CONFIG.overpass
    console.log(
        `[${label}] Discovering line refs for operators: ${SEED_CONFIG.operators.join(', ')} (route types: ${SEED_CONFIG.routeTypes.join(', ')})`
    )
    const elements = await fetchWithRetry(buildLineRefsQuery(), fetchTimeoutMs)
    const refs = new Set<string>()
    for (const el of elements) {
        if (el.type !== 'relation') continue
        const ref = el.tags?.ref
        if (ref !== undefined && ref !== '') refs.add(ref)
    }
    const sorted = Array.from(refs).sort()
    console.log(`[${label}] Found ${sorted.length} line refs: ${sorted.join(', ')}`)
    return sorted
}

const fetchInBatches = async (
    label: string,
    refs: readonly string[],
    buildQuery: (batch: readonly string[]) => string
): Promise<OsmElement[]> => {
    const { fetchTimeoutMs } = SEED_CONFIG.overpass
    const batches = chunk(refs, BATCH_SIZE)
    const all: OsmElement[] = []

    for (let i = 0; i < batches.length; i++) {
        if (i > 0) {
            console.log(`[${label}] Waiting ${BATCH_COOLDOWN_MS / 1000}s for rate limit cooldown...`)
            await sleep(BATCH_COOLDOWN_MS)
        }

        const batch = batches[i]
        console.log(`[${label}] Batch ${i + 1}/${batches.length}: ${batch.join(', ')}`)
        const elements = await fetchWithRetry(buildQuery(batch), fetchTimeoutMs)
        console.log(`[${label}]   Got ${elements.length} elements`)
        all.push(...elements)
    }

    console.log(`[${label}] Total: ${all.length} elements`)
    return all
}

/* Given the line refs we set out to fetch, return those that have no route
 * relation in the response. A batched `out geom`/`out body` query can hit a
 * server-side Overpass timeout and still return HTTP 200 with partial data, so
 * checking for missing refs is the only way to distinguish a truncated response
 * from a genuinely complete one. */
export const findMissingRouteRefs = (expectedRefs: readonly string[], elements: OsmElement[]): string[] => {
    const present = new Set<string>()
    for (const el of elements) {
        if (el.type !== 'relation') continue
        if (el.tags?.type !== 'route') continue
        // Record indexing is typed `string` but a relation may have no `ref` tag.
        const ref = el.tags.ref as string | undefined
        if (ref !== undefined && ref !== '') present.add(ref)
    }
    return expectedRefs.filter((ref) => !present.has(ref))
}

/* Turn a silently-truncated Overpass response into a hard failure so the
 * snapshot is never written from incomplete data (which would drop whole
 * lines, e.g. a freshly added S15). */
const assertAllRefsPresent = (label: string, expectedRefs: readonly string[], elements: OsmElement[]): void => {
    const missing = findMissingRouteRefs(expectedRefs, elements)
    if (missing.length > 0) {
        throw new Error(
            `[${label}] Incomplete Overpass response: ${missing.length}/${expectedRefs.length} discovered line refs returned no route relation (${missing.join(', ')}). ` +
                'A batch likely hit a server-side timeout and returned partial data — re-run the refresh.'
        )
    }
}

export const fetchStationElements = async (): Promise<OsmElement[]> => {
    const refs = await fetchLineRefs('seed:stations')
    const elements = await fetchInBatches('seed:stations', refs, buildStationsQuery)
    assertAllRefsPresent('seed:stations', refs, elements)
    return elements
}

export const fetchRouteGeometryElements = async (): Promise<OsmElement[]> => {
    const refs = await fetchLineRefs('seed:segments')
    const elements = await fetchInBatches('seed:segments', refs, buildGeometryQuery)
    assertAllRefsPresent('seed:segments', refs, elements)
    return elements
}
