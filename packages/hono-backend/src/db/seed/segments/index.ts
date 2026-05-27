import { inArray, sql } from 'drizzle-orm'

import { logger } from '../../../common/logger'
import type { DbConnection } from '../../index'
import { segments } from '../../schema/segments'
import { SEED_CONFIG } from '../config'
import type { LineVariant } from '../lines/build-variants'
import type { Coordinates } from '../stations/merge-proximate'
import type { OsmElement, OsmRelation, OsmWay, OsmWayGeometryPoint } from '../stations/overpass'

type Point = [number, number]

interface ProjectedPoint {
    distanceAlong: number
    point: Point
    offset: number
}

interface RouteGeometry {
    relation: OsmRelation
    branches: Point[][]
}

interface WayShape {
    id: number
    coords: Point[]
    startKey: string
    endKey: string
}

const CONNECTION_EPSILON = 1e-6
const MIN_SEGMENT_LENGTH = 1e-9

const toPoint = (coordinates: Coordinates): Point => [coordinates.longitude, coordinates.latitude]

const distance = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1])

const samePoint = (a: Point, b: Point): boolean => distance(a, b) <= CONNECTION_EPSILON

const perpendicularDistance = (point: Point, start: Point, end: Point): number => {
    const dx = end[0] - start[0]
    const dy = end[1] - start[1]
    if (dx === 0 && dy === 0) return distance(point, start)
    return Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / Math.hypot(dx, dy)
}

const simplifySection = (coords: Point[], tolerance: number): Point[] => {
    if (coords.length <= 2) return coords

    let maxDistance = -1
    let splitIndex = -1
    const start = coords[0]
    const end = coords[coords.length - 1]

    for (let i = 1; i < coords.length - 1; i++) {
        const candidateDistance = perpendicularDistance(coords[i], start, end)
        if (candidateDistance > maxDistance) {
            maxDistance = candidateDistance
            splitIndex = i
        }
    }

    if (maxDistance <= tolerance || splitIndex === -1) {
        return [start, end]
    }

    const left = simplifySection(coords.slice(0, splitIndex + 1), tolerance)
    const right = simplifySection(coords.slice(splitIndex), tolerance)
    return [...left.slice(0, -1), ...right]
}

const simplifyPolyline = (coords: Point[]): Point[] => {
    const tolerance = SEED_CONFIG.geometrySimplificationTolerance
    if (coords.length <= 2) return coords

    const simplified = simplifySection(coords, tolerance)
    return simplified.length >= 2 ? simplified : [coords[0], coords[coords.length - 1]]
}

const appendBranch = (branch: Point[], next: Point[]): Point[] => {
    if (branch.length === 0) return [...next]
    if (next.length === 0) return [...branch]
    return samePoint(branch[branch.length - 1], next[0]) ? [...branch, ...next.slice(1)] : [...branch, ...next]
}

const projectPointToSegment = (point: Point, start: Point, end: Point): { point: Point; t: number; offset: number } => {
    const dx = end[0] - start[0]
    const dy = end[1] - start[1]
    const lenSquared = dx * dx + dy * dy
    if (lenSquared === 0) {
        return { point: start, t: 0, offset: distance(point, start) }
    }

    const rawT = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lenSquared
    const t = Math.max(0, Math.min(1, rawT))
    const projected: Point = [start[0] + dx * t, start[1] + dy * t]
    return { point: projected, t, offset: distance(point, projected) }
}

const polylineLength = (coords: Point[]): number => {
    let total = 0
    for (let i = 0; i < coords.length - 1; i++) total += distance(coords[i], coords[i + 1])
    return total
}

const projectPointToPolyline = (point: Point, coords: Point[]): ProjectedPoint | null => {
    if (coords.length < 2) return null

    let best: ProjectedPoint | null = null
    let traversed = 0

    for (let i = 0; i < coords.length - 1; i++) {
        const start = coords[i]
        const end = coords[i + 1]
        const segmentLength = distance(start, end)
        const projected = projectPointToSegment(point, start, end)
        const candidate: ProjectedPoint = {
            distanceAlong: traversed + segmentLength * projected.t,
            point: projected.point,
            offset: projected.offset,
        }
        if (best === null || candidate.offset < best.offset) best = candidate
        traversed += segmentLength
    }

    return best
}

const slicePolyline = (coords: Point[], startDistance: number, endDistance: number): Point[] => {
    if (coords.length < 2 || endDistance - startDistance < MIN_SEGMENT_LENGTH) return []

    const out: Point[] = []
    let traversed = 0

    for (let i = 0; i < coords.length - 1; i++) {
        const start = coords[i]
        const end = coords[i + 1]
        const segmentLength = distance(start, end)
        const segmentStart = traversed
        const segmentEnd = traversed + segmentLength

        if (segmentLength <= MIN_SEGMENT_LENGTH || segmentEnd < startDistance || segmentStart > endDistance) {
            traversed = segmentEnd
            continue
        }

        const clipStart = Math.max(startDistance, segmentStart)
        const clipEnd = Math.min(endDistance, segmentEnd)
        const startT = (clipStart - segmentStart) / segmentLength
        const endT = (clipEnd - segmentStart) / segmentLength
        const clippedStart: Point = [start[0] + (end[0] - start[0]) * startT, start[1] + (end[1] - start[1]) * startT]
        const clippedEnd: Point = [start[0] + (end[0] - start[0]) * endT, start[1] + (end[1] - start[1]) * endT]

        if (out.length === 0 || !samePoint(out[out.length - 1], clippedStart)) out.push(clippedStart)
        if (!samePoint(out[out.length - 1], clippedEnd)) out.push(clippedEnd)

        traversed = segmentEnd
    }

    return out.length >= 2 && polylineLength(out) >= MIN_SEGMENT_LENGTH ? out : []
}

const deduplicateGeometryPoints = (geometry: OsmWayGeometryPoint[] | undefined): Point[] => {
    if (!geometry) return []
    const out: Point[] = []
    for (const entry of geometry) {
        const point: Point = [entry.lon, entry.lat]
        if (out.length === 0 || !samePoint(out[out.length - 1], point)) out.push(point)
    }
    return out
}

const coordinateKey = (point: Point): string => `p:${point[0].toFixed(7)},${point[1].toFixed(7)}`

const buildWayShape = (way: OsmWay): WayShape | null => {
    const coords = deduplicateGeometryPoints(way.geometry)
    if (coords.length < 2) return null

    const startNode = way.nodes?.[0]
    const endNode = way.nodes?.[way.nodes.length - 1]
    const startKey = startNode !== undefined ? `n:${startNode}` : coordinateKey(coords[0])
    const endKey = endNode !== undefined ? `n:${endNode}` : coordinateKey(coords[coords.length - 1])

    return { id: way.id, coords, startKey, endKey }
}

const reverseWayShape = (shape: WayShape): WayShape => ({
    id: shape.id,
    coords: [...shape.coords].reverse(),
    startKey: shape.endKey,
    endKey: shape.startKey,
})

const mergeRelationMembers = (existing: OsmRelation, rel: OsmRelation) => {
    const seen = new Set(existing.members.map((m) => `${m.type}:${m.ref}:${m.role}`))
    for (const member of rel.members) {
        const key = `${member.type}:${member.ref}:${member.role}`
        if (!seen.has(key)) {
            existing.members.push(member)
            seen.add(key)
        }
    }
}

const collectConnectedWayIds = (
    seedId: number,
    adjacency: Map<string, Set<number>>,
    waysById: Map<number, WayShape>
): Set<number> => {
    const seen = new Set<number>()
    const stack = [seedId]

    while (stack.length > 0) {
        const currentId = stack.pop()!
        if (seen.has(currentId)) continue
        seen.add(currentId)

        const shape = waysById.get(currentId)
        if (!shape) continue

        for (const key of [shape.startKey, shape.endKey]) {
            for (const neighborId of adjacency.get(key) ?? []) {
                if (!seen.has(neighborId)) stack.push(neighborId)
            }
        }
    }

    return seen
}

const appendOrientedWay = (branch: Point[], way: WayShape): Point[] => appendBranch(branch, way.coords)

const walkBranch = (
    startNodeKey: string,
    seedWayId: number,
    componentWayIds: Set<number>,
    waysById: Map<number, WayShape>,
    adjacency: Map<string, Set<number>>,
    usedWayIds: Set<number>
): Point[] => {
    let branch: Point[] = []
    let currentNodeKey = startNodeKey
    let currentWayId = seedWayId

    for (;;) {
        const rawWay = waysById.get(currentWayId)
        if (!rawWay) break

        let oriented: WayShape | null = null
        if (rawWay.startKey === currentNodeKey) {
            oriented = rawWay
        } else if (rawWay.endKey === currentNodeKey) {
            oriented = reverseWayShape(rawWay)
        }
        if (!oriented) break

        branch = appendOrientedWay(branch, oriented)
        usedWayIds.add(currentWayId)
        currentNodeKey = oriented.endKey

        const nextWayIds = Array.from(adjacency.get(currentNodeKey) ?? []).filter(
            (wayId) => componentWayIds.has(wayId) && !usedWayIds.has(wayId)
        )
        if (nextWayIds.length !== 1) break
        currentWayId = nextWayIds[0]
    }

    return branch
}

const buildBranchesForComponent = (
    componentWayIds: Set<number>,
    waysById: Map<number, WayShape>,
    adjacency: Map<string, Set<number>>
): Point[][] => {
    const branches: Point[][] = []
    const usedWayIds = new Set<number>()
    const nodeDegree = new Map<string, number>()

    for (const wayId of componentWayIds) {
        const way = waysById.get(wayId)
        if (!way) continue
        nodeDegree.set(way.startKey, (nodeDegree.get(way.startKey) ?? 0) + 1)
        nodeDegree.set(way.endKey, (nodeDegree.get(way.endKey) ?? 0) + 1)
    }

    const startNodes = Array.from(nodeDegree.entries())
        .filter(([, degree]) => degree !== 2)
        .map(([key]) => key)

    for (const startNodeKey of startNodes) {
        for (const wayId of adjacency.get(startNodeKey) ?? []) {
            if (!componentWayIds.has(wayId) || usedWayIds.has(wayId)) continue
            const branch = walkBranch(startNodeKey, wayId, componentWayIds, waysById, adjacency, usedWayIds)
            if (branch.length >= 2) branches.push(branch)
        }
    }

    for (const wayId of componentWayIds) {
        if (usedWayIds.has(wayId)) continue
        const way = waysById.get(wayId)
        if (!way) continue
        const branch = walkBranch(way.startKey, wayId, componentWayIds, waysById, adjacency, usedWayIds)
        if (branch.length >= 2) branches.push(branch)
    }

    return branches
}

const buildRouteGeometries = (elements: OsmElement[]): Map<number, RouteGeometry> => {
    const relations = new Map<number, OsmRelation>()
    const ways = new Map<number, OsmWay>()

    for (const element of elements) {
        if (element.type === 'relation') {
            const rel = element as OsmRelation
            const existing = relations.get(rel.id)
            if (existing) {
                mergeRelationMembers(existing, rel)
            } else {
                relations.set(rel.id, { ...rel, members: [...rel.members] })
            }
        } else if (element.type === 'way') {
            const way = element as OsmWay
            if (way.geometry !== undefined) ways.set(way.id, way)
        }
    }

    const out = new Map<number, RouteGeometry>()

    for (const relation of relations.values()) {
        const seenWayIds = new Set<number>()
        const relationWays = new Map<number, WayShape>()
        const adjacency = new Map<string, Set<number>>()

        for (const member of relation.members) {
            if (member.type !== 'way') continue
            if (seenWayIds.has(member.ref)) continue
            seenWayIds.add(member.ref)
            const way = ways.get(member.ref)
            if (!way) continue
            const shape = buildWayShape(way)
            if (!shape) continue
            relationWays.set(shape.id, shape)

            for (const key of [shape.startKey, shape.endKey]) {
                const incident = adjacency.get(key) ?? new Set<number>()
                incident.add(shape.id)
                adjacency.set(key, incident)
            }
        }

        const branches: Point[][] = []
        const remainingWayIds = new Set(relationWays.keys())

        while (remainingWayIds.size > 0) {
            const seedWayId = remainingWayIds.values().next().value as number
            const componentWayIds = collectConnectedWayIds(seedWayId, adjacency, relationWays)
            for (const wayId of componentWayIds) remainingWayIds.delete(wayId)
            branches.push(...buildBranchesForComponent(componentWayIds, relationWays, adjacency))
        }

        out.set(relation.id, { relation, branches })
    }

    return out
}

const buildSegmentRecords = (
    variants: LineVariant[],
    stationCoordinates: Map<string, Coordinates>,
    geometries: Map<number, RouteGeometry>
) => {
    const records: Array<{
        lineId: string
        fromStationId: string
        toStationId: string
        position: number
        color: string
        coordinates: [number, number][]
    }> = []

    for (const variant of variants) {
        const routeGeometry = geometries.get(variant.osmRelationId)
        if (!routeGeometry || routeGeometry.branches.length === 0) {
            logger.warn(`[seed:segments] ${variant.id}: missing geometry for relation ${variant.osmRelationId}`)
            continue
        }

        // Color is a line property; segments inherit it so map rendering stays
        // Consistent with the line badge color.
        const color = variant.color

        for (let position = 0; position < variant.stationIds.length - 1; position++) {
            const fromStationId = variant.stationIds[position]
            const toStationId = variant.stationIds[position + 1]
            const fromCoordinates = stationCoordinates.get(fromStationId)
            const toCoordinates = stationCoordinates.get(toStationId)

            if (!fromCoordinates || !toCoordinates) {
                logger.warn(
                    `[seed:segments] ${variant.id}: missing coordinates for ${!fromCoordinates ? fromStationId : toStationId}`
                )
                continue
            }

            const fromPoint = toPoint(fromCoordinates)
            const toPointCoordinates = toPoint(toCoordinates)

            let bestCoordinates: Point[] | null = null
            let bestScore = Number.POSITIVE_INFINITY

            for (const branch of routeGeometry.branches) {
                const projectedFrom = projectPointToPolyline(fromPoint, branch)
                const projectedTo = projectPointToPolyline(toPointCoordinates, branch)
                if (!projectedFrom || !projectedTo) continue

                const startDistance = Math.min(projectedFrom.distanceAlong, projectedTo.distanceAlong)
                const endDistance = Math.max(projectedFrom.distanceAlong, projectedTo.distanceAlong)
                if (endDistance - startDistance < MIN_SEGMENT_LENGTH) continue

                const candidate = slicePolyline(branch, startDistance, endDistance)
                if (candidate.length < 2) continue

                const score = projectedFrom.offset + projectedTo.offset
                if (score < bestScore) {
                    bestScore = score
                    bestCoordinates = candidate
                }
            }

            if (!bestCoordinates) {
                logger.warn(`[seed:segments] ${variant.id}: could not build segment ${fromStationId} -> ${toStationId}`)
                continue
            }

            records.push({
                lineId: variant.id,
                fromStationId,
                toStationId,
                position,
                color,
                coordinates: bestCoordinates,
            })
        }
    }

    return records
}

export const seedSegmentsFromGeometry = async (
    db: DbConnection,
    variants: LineVariant[],
    stationCoordinates: Map<string, Coordinates>,
    geometryElements: OsmElement[]
): Promise<void> => {
    const geometries = buildRouteGeometries(geometryElements)
    const records = buildSegmentRecords(variants, stationCoordinates, geometries)
    const originalVertexCount = records.reduce((total, record) => total + record.coordinates.length, 0)
    const simplifiedRecords = records.map((record) => ({
        ...record,
        coordinates: simplifyPolyline(record.coordinates),
    }))
    const simplifiedVertexCount = simplifiedRecords.reduce((total, record) => total + record.coordinates.length, 0)

    if (simplifiedRecords.length === 0) {
        throw new Error('Segment seed produced zero segments — aborting')
    }

    await db.transaction(async (tx) => {
        // Upsert keyed on the natural (lineId, fromStationId, toStationId) tuple
        // So existing segment ids stay stable across re-seeds. The serial 'id'
        // Column is what the risk model and the frontend's localStorage cache
        // Refer to, so churning ids on every seed would invalidate both.
        await tx
            .insert(segments)
            .values(simplifiedRecords)
            .onConflictDoUpdate({
                target: [segments.lineId, segments.fromStationId, segments.toStationId],
                set: {
                    position: sql`excluded.position`,
                    color: sql`excluded.color`,
                    coordinates: sql`excluded.coordinates`,
                },
            })

        // Prune segments that no longer exist in the snapshot.
        const newKeys = new Set(simplifiedRecords.map((r) => `${r.lineId}|${r.fromStationId}|${r.toStationId}`))
        const existing = await tx
            .select({
                id: segments.id,
                lineId: segments.lineId,
                fromStationId: segments.fromStationId,
                toStationId: segments.toStationId,
            })
            .from(segments)
        const obsoleteIds = existing
            .filter((row) => !newKeys.has(`${row.lineId}|${row.fromStationId}|${row.toStationId}`))
            .map((row) => row.id)
        if (obsoleteIds.length > 0) {
            await tx.delete(segments).where(inArray(segments.id, obsoleteIds))
        }
    })

    logger.info(
        `[seed:segments] Upserted ${simplifiedRecords.length} segments ` +
            `(${originalVertexCount} → ${simplifiedVertexCount} coordinates after simplification)`
    )
}
