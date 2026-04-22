import { SEED_CONFIG, ROUTE_TYPE_PRIORITY } from '../config'

import type { StationDataset } from './build-dataset'

export interface Coordinates {
    latitude: number
    longitude: number
}

/** Compute the great-circle distance between two coordinate pairs in meters. */
const haversine = (a: Coordinates, b: Coordinates): number => {
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const lat1 = toRad(a.latitude)
    const lon1 = toRad(a.longitude)
    const lat2 = toRad(b.latitude)
    const lon2 = toRad(b.longitude)

    const dlat = lat2 - lat1
    const dlon = lon2 - lon1

    const h = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2

    return 6_371_000 * 2 * Math.asin(Math.sqrt(h))
}

/**
 * Pick the best representative from a group of proximate stations.
 * Priority: lowest route-type index wins (train > subway > tram > light_rail).
 * Tiebreaker: prefer real codes over n{id} fallbacks.
 */
const pickRepresentative = (group: string[], dataset: StationDataset): string =>
    group.reduce((best, code) => {
        const bestEntry = dataset.get(best)!
        const entry = dataset.get(code)!

        const bestIdx = ROUTE_TYPE_PRIORITY.indexOf(bestEntry.highestRouteType)
        const idx = ROUTE_TYPE_PRIORITY.indexOf(entry.highestRouteType)

        if (idx < bestIdx) return code
        if (idx > bestIdx) return best

        // Tiebreaker: prefer real codes over n{id} fallbacks
        const bestIsFallback = best.startsWith('n') && /^n\d+$/.test(best)
        const isFallback = code.startsWith('n') && /^n\d+$/.test(code)
        if (bestIsFallback && !isFallback) return code
        if (!bestIsFallback && isFallback) return best

        return best
    })

// Extract the core station name by stripping common transit prefixes and suffixes.
// Works across cities: "S+U Alexanderplatz/Gontardstraße" → "alexanderplatz"
// "Gare de Lyon - Diderot" → "gare de lyon"
const coreName = (name: string): string =>
    name
        .toLowerCase()
        .split(/[/\-–—]/)  // Split on slash or dash variants
        .map((p) => p.trim())[0] // Take the first part (main name)

// Check if two stations share the same core name.
const namesMatch = (a: string, b: string): boolean => {
    const ca = coreName(a)
    const cb = coreName(b)
    return ca === cb || ca.includes(cb) || cb.includes(ca)
}

// We merge proximate stations, so that they can be considered as the same station by the risk model.
// This is important since inspectors can walk between the platforms of the merged stations.
// To users they are basically the same station, so we merge them to avoid duplicate stations in the database.
// Union-Find for transitive grouping: if A is near B and B is near C, all three merge.
const makeUnionFind = (items: string[]) => {
    const parent = new Map<string, string>()
    for (const item of items) parent.set(item, item)

    const find = (x: string): string => {
        let root = x
        while (parent.get(root) !== root) root = parent.get(root)!
        // Path compression
        let curr = x
        while (curr !== root) {
            const next = parent.get(curr)!
            parent.set(curr, root)
            curr = next
        }
        return root
    }

    const union = (a: string, b: string) => {
        parent.set(find(a), find(b))
    }

    const groups = (): Map<string, string[]> => {
        const result = new Map<string, string[]>()
        for (const item of items) {
            const root = find(item)
            const group = result.get(root) ?? []
            group.push(item)
            result.set(root, group)
        }
        return result
    }

    return { find, union, groups }
}

export interface MergeResult {
    merged: StationDataset
    /** Pre-merge code → representative code it was merged into. */
    codeRemap: Map<string, string>
}

export const mergeProximate = (dataset: StationDataset): MergeResult => {
    const threshold = SEED_CONFIG.mergeThresholdMeters
    const merged: StationDataset = new Map()
    const codeRemap = new Map<string, string>()
    const codes = Array.from(dataset.keys())
    const uf = makeUnionFind(codes)

    // Build transitive groups: merge only if close AND same station name
    for (let i = 0; i < codes.length; i++) {
        const sEntry = dataset.get(codes[i])!
        for (let j = i + 1; j < codes.length; j++) {
            const oEntry = dataset.get(codes[j])!
            if (
                haversine(sEntry.coordinates, oEntry.coordinates) <= threshold &&
                namesMatch(sEntry.name, oEntry.name)
            ) {
                uf.union(codes[i], codes[j])
            }
        }
    }

    for (const [, group] of uf.groups()) {

        const rep = pickRepresentative(group, dataset)
        const repEntry = dataset.get(rep)!

        // Use representative station's coordinates (averaging shifts the point off the real station)
        const { latitude: avgLat, longitude: avgLng } = repEntry.coordinates

        // Union lines and route types
        const allLines = new Set<string>()
        const allRouteTypes = new Set(Array.from(repEntry.routeTypes))
        for (const g of group) {
            const entry = dataset.get(g)!
            for (const l of entry.lines) allLines.add(l)
            for (const rt of Array.from(entry.routeTypes)) allRouteTypes.add(rt)
            codeRemap.set(g, rep)
        }

        // Recompute highest after union
        let highestRouteType = repEntry.highestRouteType
        for (const rt of ROUTE_TYPE_PRIORITY) {
            if (allRouteTypes.has(rt)) {
                highestRouteType = rt
                break
            }
        }

        merged.set(rep, {
            name: repEntry.name,
            coordinates: { latitude: avgLat, longitude: avgLng },
            lines: Array.from(allLines).sort(),
            routeTypes: allRouteTypes,
            highestRouteType,
        })
    }

    console.log(`[seed:stations] After merge (<${threshold}m): ${merged.size} stations`)
    return { merged, codeRemap }
}
