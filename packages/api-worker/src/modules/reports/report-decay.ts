/**
 * How long a report stays *live* — that is, how long it counts as current evidence that someone is
 * being checked right now. Not a fixed hour: the more reports are coming in (the "burst rate"), the
 * faster an old one becomes stale, since a moving inspection can make a report irrelevant within
 * minutes. On top of that, a later report further along the same line's stop order counts as having
 * "overtaken" an earlier one, which then expires shortly after instead of riding out its full ttl.
 *
 * The output is a single `expiresAt` per report — an absolute instant, not a fade level. That is
 * what makes it safe to cache and safe to share: every consumer (the map, the risk model, the
 * report counter) decides "is this live?" by comparing one timestamp against its own clock, so they
 * cannot drift apart, and a cached response stays correct as it ages instead of carrying a
 * fade value that was only true at the moment it was computed. How a live report *looks* while it
 * runs down — the opacity ramp — is presentation and belongs to whoever is drawing it.
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

/*
 * When a report stops being live. Being overtaken can only ever shorten a report's life, never
 * extend it, so the two candidate instants are combined with a min rather than by branching on
 * which case applies.
 */
export const computeExpiresAtMs = (
    reportTimestampMs: number,
    ratePerMinute: number,
    chain: ChainInfo = NOT_CHAINED
): number => {
    const baseTtl = burstAdaptiveTtlMs(ratePerMinute)
    const ttlMs = chain.isChainHead ? baseTtl * CHAIN_HEAD_TTL_BOOST : baseTtl
    const ttlExpiry = reportTimestampMs + ttlMs

    if (chain.supersededAtMs === null) return ttlExpiry
    return Math.min(ttlExpiry, chain.supersededAtMs + SUPERSEDED_FADE_MS)
}

const decayKey = (report: DecayableReport): string =>
    `${report.stationId}|${report.lineId ?? ''}|${report.timestamp.getTime()}`

// A `null` expiry never expires — see the `ReportSummary` note on predicted reports.
export const isLive = (report: { expiresAt: Date | null }, nowMs: number): boolean =>
    report.expiresAt === null || report.expiresAt.getTime() > nowMs

/*
 * Runs the full pipeline (burst rate -> chain detection -> per-report expiry) over one batch and
 * stamps every report with when it stops being live.
 *
 * Nothing is filtered out here. A report past its expiry is still a report that happened, and the
 * same endpoint serves both the live map and plain history (the 24h line/station panels, the 7d
 * station counter) — dropping the expired ones would empty those views out. Callers that only want
 * what is live right now say so with `isLive`.
 */
export const annotateReportExpiry = <T extends DecayableReport>(
    reports: readonly T[],
    lines: readonly { id: string; stations: readonly string[] }[],
    nowMs: number
): (T & { expiresAt: Date })[] => {
    const lineTopologies = buildLineTopologies(lines)
    const chainByKey = computeChainInfo(reports, lineTopologies, decayKey)
    const ratePerMinute = burstRatePerMinute(reports, nowMs)

    return reports.map((report) => ({
        ...report,
        expiresAt: new Date(
            computeExpiresAtMs(report.timestamp.getTime(), ratePerMinute, chainByKey.get(decayKey(report)))
        ),
    }))
}
