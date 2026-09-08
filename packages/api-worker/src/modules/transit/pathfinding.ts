import type { CityRoutingConfig, RouteType } from '@freifahren/cities'

import { NoPathFoundError, StationNotFoundError } from '../../common/errors'

export type StationId = string
export type LineId = string

export type StationWithCoords = {
    id: StationId
    name: string
    lat: number
    lng: number
}

export type Neighbor = {
    stationId: StationId
    lineId: LineId
}

export type Graph = {
    stations: Map<StationId, StationWithCoords>
    neighbors: Map<StationId, Neighbor[]>
    lineInfo: Map<LineId, { isCircular: boolean; type: RouteType }>
}

type AStarState = {
    stationId: StationId
    gCost: number
    fCost: number
}

type LineRow = {
    id: LineId
    isCircular: boolean
    type: RouteType
}

type LineStationRow = {
    lineId: LineId
    stationId: StationId
    order: number
}

/*
 * Generic over the state type so both the hop-count search and the journey search
 * can use it; ordering only ever looks at fCost.
 */
class MinHeap<T extends { fCost: number }> {
    private heap: T[] = []

    private getParentIndex(index: number): number {
        return Math.floor((index - 1) / 2)
    }

    private getLeftChildIndex(index: number): number {
        return 2 * index + 1
    }

    private getRightChildIndex(index: number): number {
        return 2 * index + 2
    }

    private swap(i: number, j: number): void {
        const temp = this.heap[i]
        this.heap[i] = this.heap[j]
        this.heap[j] = temp
    }

    private heapifyUp(index: number): void {
        if (index === 0) return

        const parentIndex = this.getParentIndex(index)
        if (this.heap[parentIndex].fCost > this.heap[index].fCost) {
            this.swap(parentIndex, index)
            this.heapifyUp(parentIndex)
        }
    }

    private heapifyDown(index: number): void {
        const leftChildIndex = this.getLeftChildIndex(index)
        const rightChildIndex = this.getRightChildIndex(index)
        let smallest = index

        if (leftChildIndex < this.heap.length && this.heap[leftChildIndex].fCost < this.heap[smallest].fCost) {
            smallest = leftChildIndex
        }

        if (rightChildIndex < this.heap.length && this.heap[rightChildIndex].fCost < this.heap[smallest].fCost) {
            smallest = rightChildIndex
        }

        if (smallest !== index) {
            this.swap(index, smallest)
            this.heapifyDown(smallest)
        }
    }

    insert(item: T): void {
        this.heap.push(item)
        this.heapifyUp(this.heap.length - 1)
    }

    extractMin(): T | undefined {
        if (this.heap.length === 0) return undefined
        if (this.heap.length === 1) return this.heap.pop()!

        const min = this.heap[0]
        this.heap[0] = this.heap.pop()!
        this.heapifyDown(0)
        return min
    }

    isEmpty(): boolean {
        return this.heap.length === 0
    }
}

export const buildGraph = (stations: StationWithCoords[], lines: LineRow[], lineStations: LineStationRow[]): Graph => {
    const stationMap = new Map<StationId, StationWithCoords>()
    for (const station of stations) {
        stationMap.set(station.id, station)
    }

    const lineInfoMap = new Map<LineId, { isCircular: boolean; type: RouteType }>()
    for (const line of lines) {
        lineInfoMap.set(line.id, { isCircular: line.isCircular, type: line.type })
    }

    const neighborsMap = new Map<StationId, Neighbor[]>()

    const lineStationsByLine = new Map<LineId, Array<{ stationId: StationId; order: number }>>()
    for (const ls of lineStations) {
        if (!lineStationsByLine.has(ls.lineId)) {
            lineStationsByLine.set(ls.lineId, [])
        }
        lineStationsByLine.get(ls.lineId)!.push({ stationId: ls.stationId, order: ls.order })
    }

    for (const [lineId, stationList] of Array.from(lineStationsByLine.entries())) {
        const sortedStations = [...stationList].sort((a, b) => a.order - b.order)
        const isCircular = lineInfoMap.get(lineId)?.isCircular ?? false

        for (let i = 0; i < sortedStations.length; i++) {
            const currentStation = sortedStations[i].stationId

            if (!neighborsMap.has(currentStation)) {
                neighborsMap.set(currentStation, [])
            }

            if (i > 0) {
                const prevStation = sortedStations[i - 1].stationId
                neighborsMap.get(currentStation)!.push({
                    stationId: prevStation,
                    lineId,
                })
            }

            if (i < sortedStations.length - 1) {
                const nextStation = sortedStations[i + 1].stationId
                neighborsMap.get(currentStation)!.push({
                    stationId: nextStation,
                    lineId,
                })
            }

            if (isCircular && sortedStations.length > 1) {
                if (i === 0) {
                    const lastStation = sortedStations[sortedStations.length - 1].stationId
                    neighborsMap.get(currentStation)!.push({
                        stationId: lastStation,
                        lineId,
                    })
                }
                if (i === sortedStations.length - 1) {
                    const firstStation = sortedStations[0].stationId
                    neighborsMap.get(currentStation)!.push({
                        stationId: firstStation,
                        lineId,
                    })
                }
            }
        }
    }

    return {
        stations: stationMap,
        neighbors: neighborsMap,
        lineInfo: lineInfoMap,
    }
}

const calculateHeuristic = (from: StationWithCoords, to: StationWithCoords): number => {
    const latDiff = from.lat - to.lat
    const lngDiff = from.lng - to.lng
    return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)
}

export const findPathWithAStar = (graph: Graph, from: StationId, to: StationId): number => {
    const fromStation = graph.stations.get(from)
    const toStation = graph.stations.get(to)

    if (!fromStation) {
        throw new StationNotFoundError(from)
    }
    if (!toStation) {
        throw new StationNotFoundError(to)
    }

    const openSet = new MinHeap<AStarState>()
    openSet.insert({
        stationId: from,
        gCost: 0,
        fCost: calculateHeuristic(fromStation, toStation),
    })

    const visited = new Map<string, number>()
    let goalState: AStarState | null = null

    while (!openSet.isEmpty()) {
        const current = openSet.extractMin()!

        if (visited.has(current.stationId) && visited.get(current.stationId)! <= current.gCost) {
            continue
        }
        visited.set(current.stationId, current.gCost)

        if (current.stationId === to) {
            goalState = current
            break
        }

        const neighbors = graph.neighbors.get(current.stationId) ?? []
        for (const neighbor of neighbors) {
            const newGCost = current.gCost + 1

            if (visited.has(neighbor.stationId) && visited.get(neighbor.stationId)! <= newGCost) {
                continue
            }

            const neighborStation = graph.stations.get(neighbor.stationId)!
            const hCost = calculateHeuristic(neighborStation, toStation)
            const fCost = newGCost + hCost

            openSet.insert({
                stationId: neighbor.stationId,
                gCost: newGCost,
                fCost,
            })
        }
    }

    if (!goalState) {
        throw new NoPathFoundError(from, to)
    }

    return goalState.gCost
}

export type RouteEdge = {
    fromStationId: StationId
    toStationId: StationId
    lineId: LineId
    /** Seconds from journey start until entering this edge. */
    offsetSeconds: number
    rideSeconds: number
}

type RouteState = {
    stationId: StationId
    /** Line currently ridden; null only at the origin, so boarding costs no transfer. */
    lineId: LineId | null
    gCost: number
    fCost: number
}

const stateKey = (stationId: StationId, lineId: LineId | null): string => `${stationId}|${lineId ?? ''}`

const EARTH_RADIUS_METERS = 6_371_000

/*
 * Local rather than imported from the seed pipeline's helper: that module belongs to
 * the Node-only seed path and must not be pulled into the Worker bundle.
 */
const metersBetween = (a: StationWithCoords, b: StationWithCoords): number => {
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180
    const deltaLat = toRadians(b.lat - a.lat)
    const deltaLng = toRadians(b.lng - a.lng)
    const chord =
        Math.sin(deltaLat / 2) ** 2 +
        Math.sin(deltaLng / 2) ** 2 * Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat))
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(chord)))
}

/**
 * Shortest journey by estimated travel time, as the edges actually ridden.
 *
 * Unlike findPathWithAStar, which counts hops, the search state carries the line
 * being ridden. That makes a line change an ordinary edge with a cost instead of a
 * special case, and it is why a slower direct line can beat a faster one that needs
 * a transfer. Costs are seconds, so the heuristic is expressed in seconds too and
 * stays admissible.
 */
export const findRoute = (graph: Graph, from: StationId, to: StationId, routing: CityRoutingConfig): RouteEdge[] => {
    const fromStation = graph.stations.get(from)
    const toStation = graph.stations.get(to)

    if (!fromStation) {
        throw new StationNotFoundError(from)
    }
    if (!toStation) {
        throw new StationNotFoundError(to)
    }
    if (from === to) {
        return []
    }

    const heuristic = (station: StationWithCoords): number =>
        metersBetween(station, toStation) / routing.maxSpeedMetersPerSecond

    const openSet = new MinHeap<RouteState>()
    openSet.insert({ stationId: from, lineId: null, gCost: 0, fCost: heuristic(fromStation) })

    const bestCost = new Map<string, number>()
    const cameFrom = new Map<string, { state: RouteState; edge: RouteEdge }>()
    let goalState: RouteState | null = null

    while (!openSet.isEmpty()) {
        const current = openSet.extractMin()!
        const currentKey = stateKey(current.stationId, current.lineId)

        const settled = bestCost.get(currentKey)
        if (settled !== undefined && settled < current.gCost) {
            continue
        }
        bestCost.set(currentKey, current.gCost)

        if (current.stationId === to) {
            goalState = current
            break
        }

        for (const neighbor of graph.neighbors.get(current.stationId) ?? []) {
            const lineType = graph.lineInfo.get(neighbor.lineId)?.type
            if (lineType === undefined) {
                continue
            }

            const rideSeconds = routing.secondsPerHop[lineType]
            const transferSeconds =
                current.lineId !== null && current.lineId !== neighbor.lineId ? routing.transferSeconds : 0
            const gCost = current.gCost + transferSeconds + rideSeconds

            const neighborKey = stateKey(neighbor.stationId, neighbor.lineId)
            const known = bestCost.get(neighborKey)
            if (known !== undefined && known <= gCost) {
                continue
            }
            bestCost.set(neighborKey, gCost)

            cameFrom.set(neighborKey, {
                state: current,
                edge: {
                    fromStationId: current.stationId,
                    toStationId: neighbor.stationId,
                    lineId: neighbor.lineId,
                    offsetSeconds: current.gCost + transferSeconds,
                    rideSeconds,
                },
            })

            openSet.insert({
                stationId: neighbor.stationId,
                lineId: neighbor.lineId,
                gCost,
                fCost: gCost + heuristic(graph.stations.get(neighbor.stationId)!),
            })
        }
    }

    if (!goalState) {
        throw new NoPathFoundError(from, to)
    }

    const edges: RouteEdge[] = []
    let step = cameFrom.get(stateKey(goalState.stationId, goalState.lineId))
    while (step !== undefined) {
        edges.push(step.edge)
        step = cameFrom.get(stateKey(step.state.stationId, step.state.lineId))
    }
    return edges.reverse()
}
