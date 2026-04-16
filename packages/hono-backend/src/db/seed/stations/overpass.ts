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

export interface OsmRelation {
    type: 'relation'
    id: number
    tags?: Record<string, string>
    members: OsmRelationMember[]
}

export type OsmElement = OsmNode | OsmRelation | { type: 'way'; [k: string]: unknown }

export const buildStationsOverpassQuery = (): string => {
    const { city, adminLevel, lines, overpass } = SEED_CONFIG
    const lineRegex = '^(' + lines.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')$'

    return `
[out:json][timeout:${overpass.timeoutSeconds}];

// City administrative area
area["name"="${city}"]["boundary"="administrative"]["admin_level"~"${adminLevel}"]->.a;

// Route relations for the lines we want
relation
  ["type"="route"]
  ["route"~"^(train|subway|tram|light_rail)$"]
  ["ref"~"${lineRegex}"]
  (area.a)
  ->.routes;

// Only the direct member nodes of routes (stops, platforms — NOT track geometry)
node(r.routes)->.routeNodes;

// stop_area relations that contain any of those nodes
rel
  ["public_transport"="stop_area"]
  (bn.routeNodes)
  ->.stopAreas;

// All nodes inside those stop_areas (incl. station nodes)
node(r.stopAreas)->.stopNodes;

// Also pull any station node referenced directly
node.routeNodes["railway"="station"]->.directStations;
node.routeNodes["public_transport"="station"]->.directStationsPT;

// Union everything and output
(
  .routes;
  .stopAreas;
  .routeNodes;
  .stopNodes;
  .directStations;
  .directStationsPT;
);
out body;
`
}

export const fetchStationElements = async (): Promise<OsmElement[]> => {
    const query = buildStationsOverpassQuery()
    const { url, fetchTimeoutMs } = SEED_CONFIG.overpass

    console.log('[seed:stations] Fetching from Overpass API...')

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(fetchTimeoutMs),
    })

    if (!response.ok) {
        throw new Error(`Overpass API returned ${response.status}: ${await response.text()}`)
    }

    const json = (await response.json()) as { elements: OsmElement[] }
    console.log(`[seed:stations] Received ${json.elements.length} elements`)
    return json.elements
}
