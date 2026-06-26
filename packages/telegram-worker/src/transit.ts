import type { IndexVariant, TransitIndex } from './types'
import { normalizeName } from './extractor'

interface RawStation {
    name: string
    lines?: string[]
}

interface RawLine {
    id: string
    name: string
    isCircular?: boolean
    stations?: string[]
}

// Lines-per-station are derived from the variants (not the /stations `lines` field) so we
// index PUBLIC line names ("S85") rather than variant names ("S85-a") the /stations endpoint
// sometimes returns.
export function buildIndex(rawStations: Record<string, RawStation>, rawLines: RawLine[]): TransitIndex {
    const variants: IndexVariant[] = rawLines.map((line) => ({
        id: line.id,
        name: line.name,
        stations: line.stations ?? [],
    }))

    const linesByStation: Record<string, string[]> = {}
    for (const variant of variants) {
        for (const stationId of variant.stations) {
            const set = (linesByStation[stationId] ??= [])
            if (!set.includes(variant.name)) {
                set.push(variant.name)
            }
        }
    }

    const stations: TransitIndex['stations'] = {}
    const byNorm: Record<string, string[]> = {}
    for (const [stationId, props] of Object.entries(rawStations)) {
        stations[stationId] = { id: stationId, name: props.name }
        const norm = normalizeName(props.name)
        ;(byNorm[norm] ??= []).push(stationId)
        linesByStation[stationId] ??= []
    }

    const lineNames = [...new Set(variants.map((v) => v.name))].sort()
    const circularLineNames = [
        ...new Set(rawLines.filter((l) => l.isCircular).map((l) => l.name)),
    ].sort()

    return { stations, byNorm, linesByStation, lineNames, circularLineNames, variants }
}

// Fetched fresh from the backend on every call. Response caching is handled at the
// Cloudflare edge (a cache rule on /v0/transit/*), not here.
export async function getTransitIndex(backendUrl: string): Promise<TransitIndex> {
    const [stationsResp, linesResp] = await Promise.all([
        fetch(`${backendUrl}/v0/transit/stations`),
        fetch(`${backendUrl}/v0/transit/lines`),
    ])
    if (!stationsResp.ok) {
        throw new Error(`GET /v0/transit/stations failed: ${stationsResp.status}`)
    }
    if (!linesResp.ok) {
        throw new Error(`GET /v0/transit/lines failed: ${linesResp.status}`)
    }
    const rawStations = (await stationsResp.json()) as Record<string, RawStation>
    const rawLines = (await linesResp.json()) as RawLine[]
    return buildIndex(rawStations, rawLines)
}

export function stationLineNames(index: TransitIndex, stationId: string): string[] {
    return index.linesByStation[stationId] ?? []
}

export function lineNameForId(index: TransitIndex, lineId: string): string | null {
    for (const variant of index.variants) {
        if (variant.id === lineId) {
            return variant.name
        }
    }
    return null
}

// Mirrors the frontend's longest-variant fallback: of the variants whose name matches (and
// which contain the station, if given), return the id of the one with the most stations.
export function resolveLineVariant(
    index: TransitIndex,
    lineName: string,
    stationId: string | null,
): string | null {
    let candidates = index.variants.filter((v) => v.name === lineName)
    if (candidates.length === 0) {
        return null
    }
    if (stationId !== null) {
        const withStation = candidates.filter((v) => v.stations.includes(stationId))
        if (withStation.length > 0) {
            candidates = withStation
        }
    }
    return candidates.reduce((best, v) => (v.stations.length > best.stations.length ? v : best)).id
}
