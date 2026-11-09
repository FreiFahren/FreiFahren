import type { Line } from '../transit/types'

/** The stretch of a line between two neighbouring stations, in the line's own order. */
export type Section = { lineName: string; fromStationId: string; toStationId: string }

// The track between two stations, whichever line runs it and whichever way round it is listed.
export const stationPairKey = ({ fromStationId, toStationId }: Section): string =>
    fromStationId < toStationId ? `${fromStationId}\u0000${toStationId}` : `${toStationId}\u0000${fromStationId}`

type Variant = { line: Line; positions: Map<string, number> }

/*
 * Rings close back onto their first station without repeating it (the line_stations PK forbids the
 * repeat), so their first and last stations are neighbours too.
 */
const isRing = (line: Line) => line.isCircular && line.stations.length > 2

const neighbours = (line: Line, index: number): number[] => {
    const last = line.stations.length - 1
    const result: number[] = []
    if (index > 0) result.push(index - 1)
    else if (isRing(line)) result.push(last)
    if (index < last) result.push(index + 1)
    else if (isRing(line)) result.push(0)
    return result
}

const toSection = (line: Line, a: number, b: number): Section => {
    // Neighbours one apart run in line order; the ring's closing pair runs from the last station to the first.
    const [from, to] = Math.abs(a - b) === 1 ? [Math.min(a, b), Math.max(a, b)] : [Math.max(a, b), Math.min(a, b)]
    return { lineName: line.name, fromStationId: line.stations[from]!, toStationId: line.stations[to]! }
}

/**
 * The sections of a line next to `stationId`, which the caller splits a report at that station across:
 * both neighbours, or the only one at a terminus. Each variant of the line that serves the station
 * contributes, and sections they share are counted once.
 *
 * Direction is deliberately ignored. Fewer than half of all reports carry one, and letting those put
 * their full weight on one side while the rest split evenly would skew sections by how often people
 * happen to name a direction rather than by where inspectors were.
 */
export const createSectionResolver = (lines: Line[]) => {
    const variantsByName = new Map<string, Variant[]>()
    for (const line of lines) {
        const variants = variantsByName.get(line.name) ?? []
        variants.push({ line, positions: new Map(line.stations.map((stationId, index) => [stationId, index])) })
        variantsByName.set(line.name, variants)
    }

    // Grouped report rows repeat the same line and station many times over.
    const cache = new Map<string, Section[]>()
    return (lineName: string, stationId: string): Section[] => {
        const key = `${lineName}\u0000${stationId}`
        const cached = cache.get(key)
        if (cached !== undefined) return cached

        const candidates = (variantsByName.get(lineName) ?? []).flatMap(({ line, positions }) => {
            const index = positions.get(stationId)
            if (index === undefined) return []
            return neighbours(line, index).map((neighbour) => toSection(line, index, neighbour))
        })

        const unique = [...new Map(candidates.map((section) => [stationPairKey(section), section])).values()]
        cache.set(key, unique)
        return unique
    }
}
