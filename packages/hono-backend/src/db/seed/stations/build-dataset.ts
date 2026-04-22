import { SEED_CONFIG, ROUTE_TYPE_PRIORITY, type RouteType } from '../config'

import type { Coordinates } from './merge-proximate'
import type { OsmElement, OsmNode, OsmRelation } from './overpass'

export interface StationEntry {
    name: string
    coordinates: Coordinates
    lines: string[]
    routeTypes: Set<RouteType>
    highestRouteType: RouteType
}

export type StationDataset = Map<string, StationEntry>

export interface BuildResult {
    dataset: StationDataset
    /** OSM node id → pre-merge station code it belongs to (station node itself, or a stop_area member of one). */
    nodeIdToCode: Map<number, string>
}

interface RawStation {
    code: string
    name: string
    coordinates: Coordinates
}

const STATION_RAILWAY_TAGS = new Set(['station', 'halt', 'tram_stop', 'platform'])
const STATION_PT_TAGS = new Set(['station', 'stop_position', 'platform'])

const linesWhitelist = new Set<string>(SEED_CONFIG.lines)

const isRouteType = (value: string): value is RouteType => (ROUTE_TYPE_PRIORITY as readonly string[]).includes(value)

const getHighestRouteType = (types: Set<RouteType>): RouteType => {
    for (const rt of ROUTE_TYPE_PRIORITY) {
        if (types.has(rt)) return rt
    }
    // Fallback — shouldn't happen if types is non-empty
    return 'tram'
}

const collectNodes = (elements: OsmElement[], nodes: Map<number, RawStation>) => {
    for (const el of elements) {
        if (el.type !== 'node') continue
        const node = el as OsmNode
        const tags: Record<string, string | undefined> = node.tags ?? {}

        const isStation =
            STATION_RAILWAY_TAGS.has(tags.railway ?? '') || STATION_PT_TAGS.has(tags.public_transport ?? '')
        if (!isStation) continue

        const ds100 = tags['ref:ds100']
        const railwayRef = tags['railway:ref']
        const ref = tags.ref
        /* Platform-number guard: on OSM platform / stop_position nodes, a bare numeric
         * `ref` is the platform number (e.g. "2"), not a station code. Accepting it
         * collapses unrelated stations across the city under one id. */
        const refLooksLikeStationCode = ref !== undefined && ref !== '' && /[^0-9]/u.test(ref)
        const code =
            (ds100 !== undefined && ds100 !== '' ? ds100 : undefined) ??
            (railwayRef !== undefined && railwayRef !== '' ? railwayRef : undefined) ??
            (refLooksLikeStationCode ? ref : undefined) ??
            `n${node.id}`
        nodes.set(node.id, {
            code,
            name: tags.name ?? '',
            coordinates: { latitude: node.lat, longitude: node.lon },
        })
    }
}

const processStopArea = (
    rel: OsmRelation,
    nodes: Map<number, RawStation>,
    stationToMembers: Map<number, Set<number>>
) => {
    const memberNodes = rel.members.filter((m) => m.type === 'node').map((m) => m.ref)
    const stationNodes = rel.members
        .filter((m) => m.type === 'node' && (m.role === 'station' || m.role === '') && nodes.has(m.ref))
        .map((m) => m.ref)

    const anchors = stationNodes.length > 0 ? stationNodes : memberNodes.filter((id) => nodes.has(id))
    for (const st of anchors) {
        const existing = stationToMembers.get(st) ?? new Set()
        for (const n of memberNodes) existing.add(n)
        stationToMembers.set(st, existing)
    }
}

const processRoute = (
    rel: OsmRelation,
    nodeToLines: Map<number, Set<string>>,
    nodeToRouteTypes: Map<number, Set<RouteType>>
) => {
    const tags = rel.tags ?? {}
    const ref = tags.ref || tags.name
    if (!ref || !linesWhitelist.has(ref)) return

    const routeType = tags.route
    for (const m of rel.members) {
        if (m.type !== 'node') continue

        const lines = nodeToLines.get(m.ref) ?? new Set()
        lines.add(ref)
        nodeToLines.set(m.ref, lines)

        if (routeType && isRouteType(routeType)) {
            const types = nodeToRouteTypes.get(m.ref) ?? new Set()
            types.add(routeType)
            nodeToRouteTypes.set(m.ref, types)
        }
    }
}

const collectRelations = (
    elements: OsmElement[],
    nodes: Map<number, RawStation>,
    nodeToLines: Map<number, Set<string>>,
    nodeToRouteTypes: Map<number, Set<RouteType>>,
    stationToMembers: Map<number, Set<number>>
) => {
    for (const el of elements) {
        if (el.type !== 'relation') continue
        const rel = el as OsmRelation
        const tags = rel.tags ?? {}

        if (tags.public_transport === 'stop_area') {
            processStopArea(rel, nodes, stationToMembers)
        } else if (tags.type === 'route') {
            processRoute(rel, nodeToLines, nodeToRouteTypes)
        }
    }
}

const aggregateLinesForStation = (
    nodeId: number,
    nodeToLines: Map<number, Set<string>>,
    nodeToRouteTypes: Map<number, Set<RouteType>>,
    stationToMembers: Map<number, Set<number>>
): { lines: Set<string>; routeTypes: Set<RouteType> } => {
    const lines = new Set<string>(nodeToLines.get(nodeId) ?? [])
    const routeTypes = new Set<RouteType>(nodeToRouteTypes.get(nodeId) ?? [])

    const members = stationToMembers.get(nodeId)
    if (members) {
        for (const memberId of Array.from(members)) {
            const memberLines = nodeToLines.get(memberId)
            if (memberLines) {
                for (const l of Array.from(memberLines)) lines.add(l)
            }
            const memberTypes = nodeToRouteTypes.get(memberId)
            if (memberTypes) {
                for (const t of Array.from(memberTypes)) routeTypes.add(t)
            }
        }
    }

    // Enforce whitelist
    for (const l of Array.from(lines)) {
        if (!linesWhitelist.has(l)) lines.delete(l)
    }

    return { lines, routeTypes }
}

export const buildDataset = (elements: OsmElement[]): BuildResult => {
    const nodes = new Map<number, RawStation>()
    const nodeToLines = new Map<number, Set<string>>()
    const nodeToRouteTypes = new Map<number, Set<RouteType>>()
    const stationToMembers = new Map<number, Set<number>>()

    collectNodes(elements, nodes)
    collectRelations(elements, nodes, nodeToLines, nodeToRouteTypes, stationToMembers)

    const dataset: StationDataset = new Map()
    const nodeIdToCode = new Map<number, string>()

    for (const [nodeId, station] of Array.from(nodes)) {
        const { lines, routeTypes } = aggregateLinesForStation(nodeId, nodeToLines, nodeToRouteTypes, stationToMembers)

        if (lines.size === 0) continue

        if (routeTypes.size === 0) {
            // Fallback for stations with lines but no route type info
            routeTypes.add('tram')
        }

        dataset.set(station.code, {
            name: station.name,
            coordinates: station.coordinates,
            lines: Array.from(lines).sort(),
            routeTypes,
            highestRouteType: getHighestRouteType(routeTypes),
        })
        nodeIdToCode.set(nodeId, station.code)

        const members = stationToMembers.get(nodeId)
        if (members) {
            for (const memberId of Array.from(members)) {
                if (!nodeIdToCode.has(memberId)) nodeIdToCode.set(memberId, station.code)
            }
        }
    }

    console.log(`[seed:stations] Stations after build: ${dataset.size}`)
    return { dataset, nodeIdToCode }
}
