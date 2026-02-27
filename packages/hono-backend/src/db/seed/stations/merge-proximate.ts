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

// We merge proximate stations, so that they can be considered as the same station by the risk model.
// This is important since inspectors can walk between the platforms of the merged stations.
// To users they are basically the same station, so we merge them to avoid duplicate stations in the database.
export const mergeProximate = (dataset: StationDataset): StationDataset => {
    const threshold = SEED_CONFIG.mergeThresholdMeters
    const merged: StationDataset = new Map()
    const used = new Set<string>()
    const codes = Array.from(dataset.keys())

    for (let i = 0; i < codes.length; i++) {
        const sid = codes[i]
        if (used.has(sid)) continue

        const group = [sid]
        const sEntry = dataset.get(sid)!

        for (let j = i + 1; j < codes.length; j++) {
            const oid = codes[j]
            if (used.has(oid)) continue

            const oEntry = dataset.get(oid)!
            if (haversine(sEntry.coordinates, oEntry.coordinates) <= threshold) {
                group.push(oid)
            }
        }

        for (const g of group) used.add(g)

        const rep = pickRepresentative(group, dataset)
        const repEntry = dataset.get(rep)!

        // Average coordinates across group
        const avgLat = group.reduce((sum, g) => sum + dataset.get(g)!.coordinates.latitude, 0) / group.length
        const avgLng = group.reduce((sum, g) => sum + dataset.get(g)!.coordinates.longitude, 0) / group.length

        // Union lines and route types
        const allLines = new Set<string>()
        const allRouteTypes = new Set(Array.from(repEntry.routeTypes))
        for (const g of group) {
            const entry = dataset.get(g)!
            for (const l of entry.lines) allLines.add(l)
            for (const rt of Array.from(entry.routeTypes)) allRouteTypes.add(rt)
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
    return merged
}
