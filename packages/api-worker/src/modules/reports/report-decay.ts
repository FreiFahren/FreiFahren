/**
 * A report's on-map visibility (`opacity`) shrinks over time, but not at a fixed rate: the more
 * reports are coming in right now (the "burst rate"), the faster old ones become stale, since a
 * moving inspection can render a report irrelevant within minutes instead of an hour. On top of
 * that, a later report further along the same line's stop order counts as having "overtaken" an
 * earlier one — that earlier report then fades out fast on its own clock instead of riding out
 * its normal ttl.
 */

export type DecayableReport = {
    stationId: string
    lineId: string | null
    timestamp: Date
}

export const BURST_WINDOW_MS = 15 * 60 * 1000
export const BURST_REFERENCE_RATE_PER_MIN = 0.5
export const TTL_MIN_MS = 15 * 60 * 1000
export const TTL_MAX_MS = 60 * 60 * 1000
export const MIN_OPACITY = 0.4

export const AVG_HOP_TRAVEL_MS = 3 * 60 * 1000
export const CHAIN_SLACK_FACTOR = 2.5
export const SUPERSEDED_FADE_MS = 3 * 60 * 1000
export const CHAIN_HEAD_TTL_BOOST = 1.25

// Reports per minute, city-wide, over the trailing window.
export const burstRatePerMinute = (
    reports: readonly DecayableReport[],
    nowMs: number,
    windowMs: number = BURST_WINDOW_MS
): number => {
    const cutoff = nowMs - windowMs
    let count = 0
    for (const report of reports) {
        if (report.timestamp.getTime() >= cutoff) count++
    }
    return count / (windowMs / 60_000)
}

// At referenceRate the ttl sits exactly between the min and max bound; busier periods pull it
// toward TTL_MIN_MS, quiet ones toward TTL_MAX_MS.
export const burstAdaptiveTtlMs = (
    ratePerMinute: number,
    referenceRate: number = BURST_REFERENCE_RATE_PER_MIN
): number => TTL_MIN_MS + (TTL_MAX_MS - TTL_MIN_MS) / (1 + ratePerMinute / referenceRate)

export type ChainInfo = {
    supersededAtMs: number | null
    isChainHead: boolean
}

const NOT_CHAINED: ChainInfo = { supersededAtMs: null, isChainHead: true }

export type LineTopologies = ReadonlyMap<string, readonly string[]>

export const buildLineTopologies = (lines: readonly { id: string; stations: readonly string[] }[]): LineTopologies =>
    new Map(lines.map((line) => [line.id, line.stations]))

/*
 * A report is "overtaken" by a later one on the same line once the gap between them fits within
 * the travel time a controller would need to cover the stations in between, times a slack factor
 * for dwell time and irregular schedules. Among all later candidates only the temporally nearest
 * one counts (the first match in the time-sorted list).
 */
export const computeChainInfo = <T extends DecayableReport>(
    reports: readonly T[],
    lineTopologies: LineTopologies,
    keyOf: (report: T) => string
): ReadonlyMap<string, ChainInfo> => {
    const info = new Map<string, ChainInfo>(reports.map((report) => [keyOf(report), { ...NOT_CHAINED }]))

    const byLine = new Map<string, T[]>()
    for (const report of reports) {
        if (report.lineId === null) continue
        const list = byLine.get(report.lineId)
        if (list !== undefined) list.push(report)
        else byLine.set(report.lineId, [report])
    }

    for (const [lineId, lineReports] of byLine) {
        const stations = lineTopologies.get(lineId)
        if (!stations || stations.length < 2) continue
        const rankOf = new Map(stations.map((stationId, rank) => [stationId, rank]))

        const sorted = [...lineReports].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

        for (let i = 0; i < sorted.length; i++) {
            const earlier = sorted[i]!
            const earlierRank = rankOf.get(earlier.stationId)
            if (earlierRank === undefined) continue
            const earlierMs = earlier.timestamp.getTime()
            const earlierKey = keyOf(earlier)

            for (let j = i + 1; j < sorted.length; j++) {
                const later = sorted[j]!
                const laterRank = rankOf.get(later.stationId)
                if (laterRank === undefined) continue

                const hopCount = Math.abs(laterRank - earlierRank)
                if (hopCount === 0) continue

                const laterMs = later.timestamp.getTime()
                const maxGapMs = hopCount * AVG_HOP_TRAVEL_MS * CHAIN_SLACK_FACTOR
                if (laterMs - earlierMs > maxGapMs) continue

                const laterKey = keyOf(later)
                info.set(earlierKey, { supersededAtMs: laterMs, isChainHead: false })
                info.set(laterKey, { ...(info.get(laterKey) ?? NOT_CHAINED), isChainHead: true })
                break
            }
        }
    }

    return info
}

export type DecayResult = {
    opacity: number
    ttlMs: number
    dropped: boolean
}

export const computeReportDecay = (
    reportTimestampMs: number,
    nowMs: number,
    ratePerMinute: number,
    chain: ChainInfo = NOT_CHAINED
): DecayResult => {
    const baseTtl = burstAdaptiveTtlMs(ratePerMinute)
    const ttlMs = chain.isChainHead ? baseTtl * CHAIN_HEAD_TTL_BOOST : baseTtl

    if (chain.supersededAtMs !== null && nowMs >= chain.supersededAtMs) {
        const sinceSuperseded = nowMs - chain.supersededAtMs
        if (sinceSuperseded >= SUPERSEDED_FADE_MS) return { opacity: 0, ttlMs, dropped: true }
        const opacity = MIN_OPACITY * (1 - sinceSuperseded / SUPERSEDED_FADE_MS)
        return { opacity, ttlMs, dropped: false }
    }

    const age = nowMs - reportTimestampMs
    if (age >= ttlMs) return { opacity: 0, ttlMs, dropped: true }
    const opacity = Math.max(MIN_OPACITY, 1 - age / ttlMs)
    return { opacity, ttlMs, dropped: false }
}

const decayKey = (report: DecayableReport): string =>
    `${report.stationId}|${report.lineId ?? ''}|${report.timestamp.getTime()}`

/*
 * Runs the full pipeline (burst rate -> chain detection -> per-report decay) over one batch of
 * reports and drops whichever ones decayed to zero opacity, so callers get back exactly the set
 * that should still be visible, each carrying the opacity it should be rendered at.
 */
export const applyReportDecay = <T extends DecayableReport>(
    reports: readonly T[],
    lines: readonly { id: string; stations: readonly string[] }[],
    nowMs: number
): (T & { opacity: number })[] => {
    const lineTopologies = buildLineTopologies(lines)
    const chainByKey = computeChainInfo(reports, lineTopologies, decayKey)
    const ratePerMinute = burstRatePerMinute(reports, nowMs)

    const visible: (T & { opacity: number })[] = []
    for (const report of reports) {
        const chain = chainByKey.get(decayKey(report))
        const { opacity, dropped } = computeReportDecay(report.timestamp.getTime(), nowMs, ratePerMinute, chain)
        if (dropped) continue
        visible.push({ ...report, opacity })
    }
    return visible
}
