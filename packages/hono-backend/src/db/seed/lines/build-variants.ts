import { logger } from '../../../common/logger'
import { ROUTE_TYPE_PRIORITY, SEED_CONFIG, type RouteType } from '../config'
import type { OsmRelation } from '../stations/overpass'

export interface LineVariant {
    /** Final `lines.id` value. */
    id: string
    /** Display ref, written to `lines.name` (e.g. "M1"). */
    ref: string
    /** Transport type derived from the OSM `route` tag, restricted to the configured set. */
    type: RouteType
    stationIds: string[]
    osmRelationId: number
    isCircular: boolean
}

interface RawVariant {
    ref: string
    type: RouteType
    osmRelationId: number
    stationIds: string[]
    isCircular: boolean
}

const isRouteType = (value: string | undefined): value is RouteType =>
    value !== undefined && (ROUTE_TYPE_PRIORITY as readonly string[]).includes(value)

const LINE_ID_MAX_LENGTH = 16
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'

const resolveRouteStations = (rel: OsmRelation, nodeIdToStationId: Map<number, string>): string[] => {
    const result: string[] = []
    for (const member of rel.members) {
        if (member.type !== 'node') continue
        const stationId = nodeIdToStationId.get(member.ref)
        if (stationId === undefined) continue
        if (result.length > 0 && result[result.length - 1] === stationId) continue
        result.push(stationId)
    }
    return result
}

const terminalPairKey = (stationIds: string[]): string => {
    const first = stationIds[0]
    const last = stationIds[stationIds.length - 1]
    return first < last ? `${first}|${last}` : `${last}|${first}`
}

const isStrictSubset = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => {
    if (a.size >= b.size) return false
    for (const item of a) {
        if (!b.has(item)) return false
    }
    return true
}

const pickLongest = (variants: RawVariant[]): RawVariant =>
    variants.reduce((best, v) => (v.stationIds.length > best.stationIds.length ? v : best))

const dropSubsetVariants = (variants: RawVariant[]): RawVariant[] => {
    const sets = variants.map((v) => new Set(v.stationIds))
    return variants.filter((_, i) => !sets.some((other, j) => i !== j && isStrictSubset(sets[i], other)))
}

const suffixFor = (index: number): string => {
    if (index < LETTERS.length) return LETTERS[index]
    const first = Math.floor(index / LETTERS.length) - 1
    const second = index % LETTERS.length
    return `${LETTERS[first]}${LETTERS[second]}`
}

const assignVariantId = (ref: string, suffix: string | null): string => {
    const id = suffix === null ? ref : `${ref}-${suffix}`
    if (id.length > LINE_ID_MAX_LENGTH) {
        throw new Error(`[seed:lines] Variant id "${id}" exceeds ${LINE_ID_MAX_LENGTH} chars (lines.id column width).`)
    }
    return id
}

/**
 * Ring lines (e.g. Berlin S41/S42) start and end at the same station. The
 * line_stations PK is (line_id, station_id), so the closing duplicate must be
 * dropped and the circular flag recorded instead. A defensive dedup afterwards
 * warns and skips further repeats rather than crashing on constraint violation.
 */
const normalizeSequence = (ref: string, stationIds: string[]): { stationIds: string[]; isCircular: boolean } => {
    const isCircular = stationIds.length > 2 && stationIds[0] === stationIds[stationIds.length - 1]
    const trimmed = isCircular ? stationIds.slice(0, -1) : stationIds
    const seen = new Set<string>()
    const deduped: string[] = []
    let droppedDuplicates = 0
    for (const id of trimmed) {
        if (seen.has(id)) {
            droppedDuplicates++
            continue
        }
        seen.add(id)
        deduped.push(id)
    }
    if (droppedDuplicates > 0) {
        logger.warn(
            `[seed:lines] ${ref}: dropped ${droppedDuplicates} repeated station(s) to satisfy (line_id, station_id) PK`
        )
    }
    return { stationIds: deduped, isCircular }
}

export const buildLineVariants = (relations: OsmRelation[], nodeIdToStationId: Map<number, string>): LineVariant[] => {
    const raw: RawVariant[] = []
    let skippedNoRef = 0
    let skippedTooShort = 0
    let skippedUnknownType = 0

    for (const rel of relations) {
        const tags: Record<string, string | undefined> = rel.tags ?? {}
        const ref = tags.ref
        if (ref === undefined || ref === '') {
            skippedNoRef++
            continue
        }

        if (!isRouteType(tags.route)) {
            skippedUnknownType++
            continue
        }
        const type: RouteType = tags.route

        const resolved = resolveRouteStations(rel, nodeIdToStationId)
        if (resolved.length < 2) {
            skippedTooShort++
            continue
        }
        const { stationIds, isCircular } = normalizeSequence(ref, resolved)
        if (stationIds.length < 2) {
            skippedTooShort++
            continue
        }

        raw.push({ ref, type, osmRelationId: rel.id, stationIds, isCircular })
    }

    logger.info(
        `[seed:lines] Parsed ${raw.length} route variants (${skippedNoRef} no-ref, ${skippedTooShort} too-short, ${skippedUnknownType} unsupported route type)`
    )

    const byRef = new Map<string, RawVariant[]>()
    for (const v of raw) {
        const list = byRef.get(v.ref) ?? []
        list.push(v)
        byRef.set(v.ref, list)
    }

    const missingRefs = SEED_CONFIG.lines.filter((ref) => !byRef.has(ref))
    if (missingRefs.length > 0) {
        /* Refresh-time assertion already guards against this; a warning here is
         * just defense-in-depth for hand-edited snapshots. */
        logger.warn(
            `[seed:lines] Snapshot has no route relations for configured refs: ${missingRefs.join(', ')}. ` +
                `Run \`bun db:seed:refresh\` to fetch a fresh snapshot.`
        )
    }

    const result: LineVariant[] = []

    for (const [ref, variants] of byRef) {
        // Collapse forward/backward pairs by unordered terminal pair — keep the longest per group.
        const byTerminalPair = new Map<string, RawVariant[]>()
        for (const v of variants) {
            const key = terminalPairKey(v.stationIds)
            const list = byTerminalPair.get(key) ?? []
            list.push(v)
            byTerminalPair.set(key, list)
        }

        const collapsed = Array.from(byTerminalPair.values()).map(pickLongest)
        const filtered = dropSubsetVariants(collapsed)

        // Deterministic order: by terminal-pair key.
        filtered.sort((a, b) => terminalPairKey(a.stationIds).localeCompare(terminalPairKey(b.stationIds)))

        if (filtered.length === 1) {
            const v = filtered[0]
            result.push({
                id: assignVariantId(ref, null),
                ref,
                type: v.type,
                stationIds: v.stationIds,
                osmRelationId: v.osmRelationId,
                isCircular: v.isCircular,
            })
            const ringLabel = v.isCircular ? ' [circular]' : ''
            logger.info(`[seed:lines] ${ref} → 1 variant (${v.stationIds.length} stations${ringLabel})`)
        } else {
            const suffixes = filtered.map((_, i) => suffixFor(i))
            filtered.forEach((v, i) => {
                result.push({
                    id: assignVariantId(ref, suffixes[i]),
                    ref,
                    type: v.type,
                    stationIds: v.stationIds,
                    osmRelationId: v.osmRelationId,
                    isCircular: v.isCircular,
                })
            })
            const summary = filtered
                .map((v, i) => `${assignVariantId(ref, suffixes[i])}=${v.stationIds.length}${v.isCircular ? '*' : ''}`)
                .join(', ')
            const hasCircular = filtered.some((v) => v.isCircular)
            logger.info(
                `[seed:lines] ${ref} → ${filtered.length} variants (${summary}${hasCircular ? ', *=circular' : ''})`
            )
        }
    }

    return result
}
