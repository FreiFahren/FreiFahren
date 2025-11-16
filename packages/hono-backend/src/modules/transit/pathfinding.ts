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
    lineInfo: Map<LineId, { isCircular: boolean }>
}

type AStarState = {
    stationId: StationId
    currentLineId: LineId | null
    gCost: number
    fCost: number
    parent: AStarState | null
}

type LineRow = {
    id: LineId
    isCircular: boolean
}

type LineStationRow = {
    lineId: LineId
    stationId: StationId
    order: number
}

export const LINE_SWITCH_PENALTY = 2

class MinHeap {
    private heap: AStarState[] = []

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

        if (
            leftChildIndex < this.heap.length &&
            this.heap[leftChildIndex].fCost < this.heap[smallest].fCost
        ) {
            smallest = leftChildIndex
        }

        if (
            rightChildIndex < this.heap.length &&
            this.heap[rightChildIndex].fCost < this.heap[smallest].fCost
        ) {
            smallest = rightChildIndex
        }

        if (smallest !== index) {
            this.swap(index, smallest)
            this.heapifyDown(smallest)
        }
    }

    insert(item: AStarState): void {
        this.heap.push(item)
        this.heapifyUp(this.heap.length - 1)
    }

    extractMin(): AStarState | undefined {
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

export function buildGraph(
    stations: StationWithCoords[],
    lines: LineRow[],
    lineStations: LineStationRow[]
): Graph {
    const stationMap = new Map<StationId, StationWithCoords>()
    for (const station of stations) {
        stationMap.set(station.id, station)
    }

    const lineInfoMap = new Map<LineId, { isCircular: boolean }>()
    for (const line of lines) {
        lineInfoMap.set(line.id, { isCircular: line.isCircular })
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

function calculateHeuristic(from: StationWithCoords, to: StationWithCoords): number {
    const latDiff = from.lat - to.lat
    const lngDiff = from.lng - to.lng
    return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)
}

export function findPathWithAStar(graph: Graph, from: StationId, to: StationId): number {
    const fromStation = graph.stations.get(from)
    const toStation = graph.stations.get(to)

    if (!fromStation || !toStation) {
        throw new Error('Station not found')
    }

    const openSet = new MinHeap()
    openSet.insert({
        stationId: from,
        currentLineId: null,
        gCost: 0,
        fCost: calculateHeuristic(fromStation, toStation),
        parent: null,
    })

    const visited = new Map<string, number>()
    let goalState: AStarState | null = null

    while (!openSet.isEmpty()) {
        const current = openSet.extractMin()!

        const stateKey = `${current.stationId}:${current.currentLineId ?? 'null'}`
        if (visited.has(stateKey) && visited.get(stateKey)! <= current.gCost) {
            continue
        }
        visited.set(stateKey, current.gCost)

        if (current.stationId === to) {
            goalState = current
            break
        }

        const neighbors = graph.neighbors.get(current.stationId) ?? []
        for (const neighbor of neighbors) {
            const isLineSwitch = current.currentLineId !== null && current.currentLineId !== neighbor.lineId
            const edgeCost = 1 + (isLineSwitch ? LINE_SWITCH_PENALTY : 0)
            const newGCost = current.gCost + edgeCost

            const neighborStateKey = `${neighbor.stationId}:${neighbor.lineId}`
            if (visited.has(neighborStateKey) && visited.get(neighborStateKey)! <= newGCost) {
                continue
            }

            const neighborStation = graph.stations.get(neighbor.stationId)!
            const hCost = calculateHeuristic(neighborStation, toStation)
            const fCost = newGCost + hCost

            openSet.insert({
                stationId: neighbor.stationId,
                currentLineId: neighbor.lineId,
                gCost: newGCost,
                fCost,
                parent: current,
            })
        }
    }

    if (!goalState) {
        throw new Error(`No path found between stations: ${from} → ${to}`)
    }

    return goalState.gCost
}

