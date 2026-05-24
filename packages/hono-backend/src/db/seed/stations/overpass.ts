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

const escapeForRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildOperatorRegex = (operators: readonly string[]): string =>
    '^(' + operators.map(escapeForRegex).join('|') + ')$'

const buildRouteTypeRegex = (routeTypes: readonly string[]): string =>
    '^(' + routeTypes.map(escapeForRegex).join('|') + ')$'

const buildStationsQuery = (): string => {
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

const buildGeometryQuery = (): string => {
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
    console.log(
        `[seed:stations] Fetching routes for operators: ${SEED_CONFIG.operators.join(', ')} (route types: ${SEED_CONFIG.routeTypes.join(', ')})`
    )
    const elements = await fetchWithRetry(buildStationsQuery(), fetchTimeoutMs)
    console.log(`[seed:stations] Total: ${elements.length} elements`)
    return elements
}

export const fetchRouteGeometryElements = async (): Promise<OsmElement[]> => {
    const { fetchTimeoutMs } = SEED_CONFIG.overpass
    console.log(
        `[seed:segments] Fetching route geometry for operators: ${SEED_CONFIG.operators.join(', ')} (route types: ${SEED_CONFIG.routeTypes.join(', ')})`
    )
    const elements = await fetchWithRetry(buildGeometryQuery(), fetchTimeoutMs)
    console.log(`[seed:segments] Total: ${elements.length} elements`)
    return elements
}
