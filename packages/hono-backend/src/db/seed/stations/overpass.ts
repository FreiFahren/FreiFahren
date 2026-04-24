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

const BATCH_SIZE = 10

const chunkLines = (lines: readonly string[]): string[][] => {
    const chunks: string[][] = []
    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
        chunks.push(lines.slice(i, i + BATCH_SIZE) as string[])
    }
    return chunks
}

const buildBatchQuery = (lines: string[]): string => {
    const { city, adminLevel, overpass } = SEED_CONFIG
    const lineRegex = '^(' + lines.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')$'

    return `
[out:json][timeout:${overpass.timeoutSeconds}];

area["name"="${city}"]["boundary"="administrative"]["admin_level"~"${adminLevel}"]->.a;

relation
  ["type"="route"]
  ["route"~"^(train|subway|tram|light_rail)$"]
  ["ref"~"${lineRegex}"]
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

const buildGeometryBatchQuery = (lines: string[]): string => {
    const { city, adminLevel, overpass } = SEED_CONFIG
    const lineRegex = '^(' + lines.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')$'

    return `
[out:json][timeout:${overpass.timeoutSeconds}];

area["name"="${city}"]["boundary"="administrative"]["admin_level"~"${adminLevel}"]->.a;

relation
  ["type"="route"]
  ["route"~"^(train|subway|tram|light_rail)$"]
  ["ref"~"${lineRegex}"]
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
const RETRY_DELAY_MS = 30_000

const fetchWithRetry = async (query: string, fetchTimeoutMs: number): Promise<OsmElement[]> => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        for (const endpoint of OVERPASS_ENDPOINTS) {
            console.log(`[seed:stations]   Trying ${endpoint} (attempt ${attempt}/${MAX_RETRIES})...`)
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ data: query }),
                    signal: AbortSignal.timeout(fetchTimeoutMs),
                })

                if (response.status === 429 || response.status === 504) {
                    console.warn(`[seed:stations]   ${endpoint} returned ${response.status}`)
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
            const delay = RETRY_DELAY_MS * attempt
            console.log(`[seed:stations]   All endpoints failed, retrying in ${delay / 1000}s...`)
            await sleep(delay)
        }
    }

    throw new Error('All Overpass API endpoints failed after retries')
}

export const fetchStationElements = async (): Promise<OsmElement[]> => {
    const { fetchTimeoutMs } = SEED_CONFIG.overpass
    const batches = chunkLines(SEED_CONFIG.lines)
    const allElements: OsmElement[] = []

    for (let i = 0; i < batches.length; i++) {
        if (i > 0) {
            console.log('[seed:stations] Waiting 30s for rate limit cooldown...')
            await sleep(30_000)
        }

        const batch = batches[i]
        console.log(`[seed:stations] Batch ${i + 1}/${batches.length}: ${batch.join(', ')}`)
        const query = buildBatchQuery(batch)
        const elements = await fetchWithRetry(query, fetchTimeoutMs)
        console.log(`[seed:stations]   Got ${elements.length} elements`)
        allElements.push(...elements)
    }

    console.log(`[seed:stations] Total: ${allElements.length} elements`)
    return allElements
}

export const fetchRouteGeometryElements = async (): Promise<OsmElement[]> => {
    const { fetchTimeoutMs } = SEED_CONFIG.overpass
    const batches = chunkLines(SEED_CONFIG.lines)
    const allElements: OsmElement[] = []

    for (let i = 0; i < batches.length; i++) {
        if (i > 0) {
            console.log('[seed:segments] Waiting 30s for rate limit cooldown...')
            await sleep(30_000)
        }

        const batch = batches[i]
        console.log(`[seed:segments] Batch ${i + 1}/${batches.length}: ${batch.join(', ')}`)
        const query = buildGeometryBatchQuery(batch)
        const elements = await fetchWithRetry(query, fetchTimeoutMs)
        console.log(`[seed:segments]   Got ${elements.length} elements`)
        allElements.push(...elements)
    }

    console.log(`[seed:segments] Total: ${allElements.length} elements`)
    return allElements
}
