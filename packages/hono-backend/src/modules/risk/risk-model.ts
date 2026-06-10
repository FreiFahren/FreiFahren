/**
 * For each report, three risk components (direct, bidirect, line) are
 * computed as base_risk × temporal decay (logistic in report age), then
 * spread along the report's lines with a spatial decay (beta-binomial in
 * segment distance). Components accumulate additively across reports
 * (capped at 1.0), are summed into a final risk per segment (capped at
 * 1.0), mapped to a color, and finally propagated to overlapping segments
 * (segments sharing the same unordered station pair).
 */

export type RiskModelSegment = {
    sid: string
    lineId: string
    fromStationId: string
    toStationId: string
}

export type RiskModelReport = {
    stationId: string
    lines: string[]
    directionId: string | null
    timestamp: Date
}

export type SegmentRisk = { color: string; risk: number }

const COLORS = {
    green: '#13C184',
    yellow: '#FACB3F',
    red: '#F05044',
    darkRed: '#A92725',
} as const

const riskToColor = (risk: number): string => {
    if (risk <= 0.2) return COLORS.green
    if (risk <= 0.5) return COLORS.yellow
    if (risk <= 0.9) return COLORS.red
    return COLORS.darkRed
}

type TemporalDecayParams = { ttl: number; strength: number; shift: number }

const TEMPORAL_DECAY_PARAMS: Record<'direct' | 'bidirect' | 'line', TemporalDecayParams> = {
    direct: { ttl: 1000, strength: 0.2, shift: 0.4 },
    bidirect: { ttl: 2000, strength: 0.3, shift: 0.4 },
    line: { ttl: 4000, strength: 0.3, shift: 0.2 },
}

/** Logistic decay of a report's weight as it ages, between 0 and 1. */
const temporalDecay = (timeDiffSeconds: number, { ttl, strength, shift }: TemporalDecayParams): number => {
    const adjustedTtl = ttl * (1 + shift)
    return 1 / (1 + Math.exp((timeDiffSeconds - adjustedTtl) / (strength * ttl)))
}

/*
 * Lanczos approximation (g=7, n=9) of the log-gamma function. Together with
 * the beta-binomial PMF below it replaces scipy.stats.betabinom.pmf; for the
 * parameter sets used here it matches scipy to ~1e-15.
 */
const LANCZOS_G = 7
const LANCZOS_COEFFICIENTS = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
]

const logGamma = (x: number): number => {
    if (x < 0.5) {
        // Reflection formula for the small-argument range
        return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
    }
    const shifted = x - 1
    let series = LANCZOS_COEFFICIENTS[0]!
    for (let i = 1; i < LANCZOS_COEFFICIENTS.length; i++) {
        series += LANCZOS_COEFFICIENTS[i]! / (shifted + i)
    }
    const t = shifted + LANCZOS_G + 0.5
    return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(series)
}

const logBeta = (a: number, b: number): number => logGamma(a) + logGamma(b) - logGamma(a + b)

const logChoose = (n: number, k: number): number => logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1)

/** Beta-binomial PMF: P(X = k) for X ~ BetaBin(n, alpha, beta). */
const betaBinomialPmf = (k: number, n: number, alpha: number, beta: number): number => {
    if (k < 0 || k > n) return 0
    return Math.exp(logChoose(n, k) + logBeta(k + alpha, n - k + beta) - logBeta(alpha, beta))
}

type SpatialDecayParams = { alpha: number; beta: number; size: number; peak: number; shift: number }

const SPATIAL_DECAY_PARAMS: Record<'direct' | 'bidirect' | 'line', SpatialDecayParams> = {
    direct: { alpha: 1.456, beta: 2.547, size: 6, peak: 1, shift: 0 },
    bidirect: { alpha: 1.336, beta: 1.968, size: 5, peak: 1, shift: 1 },
    line: { alpha: 0.9891, beta: 1.175, size: 30, peak: 0, shift: 0 },
}

/*
 * Distances are small non-negative integers and the parameters are constants,
 * so the scaled PMF (pmf(distance + shift) / pmf(peak)) is precomputed once
 * per decay type. Distances beyond the table have probability 0.
 */
const buildSpatialDecayTable = ({ alpha, beta, size, peak, shift }: SpatialDecayParams): number[] => {
    const peakProb = betaBinomialPmf(peak, size, alpha, beta)
    const table: number[] = []
    for (let distance = 0; distance + shift <= size; distance++) {
        const prob = betaBinomialPmf(distance + shift, size, alpha, beta)
        table.push(peakProb > 0 ? prob / peakProb : prob)
    }
    return table
}

const SPATIAL_DECAY_TABLES = {
    direct: buildSpatialDecayTable(SPATIAL_DECAY_PARAMS.direct),
    bidirect: buildSpatialDecayTable(SPATIAL_DECAY_PARAMS.bidirect),
    line: buildSpatialDecayTable(SPATIAL_DECAY_PARAMS.line),
}

const spatialDecay = (distance: number, type: 'direct' | 'bidirect' | 'line'): number =>
    SPATIAL_DECAY_TABLES[type][distance] ?? 0

const directRisk = (report: RiskModelReport, timeDiffSeconds: number): number => {
    if (report.directionId === null) return 0
    let baseRisk = 0.8 // High base risk for directed reports
    if (report.lines.length > 1) {
        /*
         * Use sqrt as a softer dampener so multi-line stations still surface
         * at least some risk above the green threshold.
         */
        baseRisk /= Math.sqrt(report.lines.length)
    }
    return baseRisk * temporalDecay(timeDiffSeconds, TEMPORAL_DECAY_PARAMS.direct)
}

const bidirectRisk = (report: RiskModelReport, timeDiffSeconds: number): number => {
    // Highest risk when direction is unknown, lower when it is known
    let baseRisk = report.directionId === null ? 1.0 : 0.2
    if (report.lines.length > 1) {
        baseRisk /= Math.sqrt(report.lines.length)
    }
    return baseRisk * temporalDecay(timeDiffSeconds, TEMPORAL_DECAY_PARAMS.bidirect)
}

const lineRisk = (report: RiskModelReport, timeDiffSeconds: number): number => {
    let baseRisk = report.stationId ? 0.05 : 0.1
    if (report.lines.length > 1) {
        baseRisk /= Math.sqrt(report.lines.length)
    }
    return baseRisk * temporalDecay(timeDiffSeconds, TEMPORAL_DECAY_PARAMS.line)
}

type RankedSegment = { sid: string; rank: number }

type LineIndex = {
    segments: RankedSegment[]
    /*
     * First segment (in line order) whose from/to station matches, like the
     * original linear scan did.
     */
    stationRank: Map<string, number>
}

const sortedPairKey = (a: string, b: string): string => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`)

/**
 * Predicts risk levels for transit segments based on inspector reports.
 * Returns only segments with non-green risk, with the risk value rounded to
 * 3 decimal places. Insertion order of the result follows the segments
 * input order, which also determines which value wins when overlapping
 * segments propagate their risk onto each other.
 */
export const predictSegmentRisk = (
    segments: RiskModelSegment[],
    reports: RiskModelReport[],
    now: Date
): Record<string, SegmentRisk> => {
    // Per-line index so the per-report loop is O(line segments) with O(1) lookups
    const lineIndexes = new Map<string, LineIndex>()
    const segmentsByStationPair = new Map<string, string[]>()
    for (const segment of segments) {
        let lineIndex = lineIndexes.get(segment.lineId)
        if (!lineIndex) {
            lineIndex = { segments: [], stationRank: new Map() }
            lineIndexes.set(segment.lineId, lineIndex)
        }
        const rank = lineIndex.segments.length
        lineIndex.segments.push({ sid: segment.sid, rank })
        if (!lineIndex.stationRank.has(segment.fromStationId)) {
            lineIndex.stationRank.set(segment.fromStationId, rank)
        }
        if (!lineIndex.stationRank.has(segment.toStationId)) {
            lineIndex.stationRank.set(segment.toStationId, rank)
        }

        const pairKey = sortedPairKey(segment.fromStationId, segment.toStationId)
        const overlapping = segmentsByStationPair.get(pairKey)
        if (overlapping) {
            overlapping.push(segment.sid)
        } else {
            segmentsByStationPair.set(pairKey, [segment.sid])
        }
    }

    // Accumulate the three risk components per segment across all reports
    const segmentRisks = new Map<string, { direct: number; bidirect: number; line: number }>()
    for (const segment of segments) {
        segmentRisks.set(segment.sid, { direct: 0, bidirect: 0, line: 0 })
    }

    for (const report of reports) {
        const timeDiffSeconds = (now.getTime() - report.timestamp.getTime()) / 1000

        const reportDirectRisk = directRisk(report, timeDiffSeconds)
        const reportBidirectRisk = bidirectRisk(report, timeDiffSeconds)
        const reportLineRisk = lineRisk(report, timeDiffSeconds)

        for (const lineId of new Set(report.lines)) {
            const lineIndex = lineIndexes.get(lineId)
            if (!lineIndex) continue

            if (report.stationId) {
                const stationRank = lineIndex.stationRank.get(report.stationId)
                if (stationRank === undefined) continue

                for (const segment of lineIndex.segments) {
                    const distance = Math.abs(segment.rank - stationRank)
                    const risks = segmentRisks.get(segment.sid)!
                    risks.direct = Math.min(1, risks.direct + reportDirectRisk * spatialDecay(distance, 'direct'))
                    risks.bidirect = Math.min(
                        1,
                        risks.bidirect + reportBidirectRisk * spatialDecay(distance, 'bidirect')
                    )
                    risks.line = Math.min(1, risks.line + reportLineRisk * spatialDecay(distance, 'line'))
                }
            } else {
                // Line-wide reports distribute the line risk to every segment
                for (const segment of lineIndex.segments) {
                    const risks = segmentRisks.get(segment.sid)!
                    risks.line = Math.min(1, risks.line + reportLineRisk)
                }
            }
        }
    }

    // Combine components and keep only non-green segments
    const segmentColors = new Map<string, SegmentRisk>()
    for (const [sid, risks] of segmentRisks) {
        const totalRisk = Math.min(1, risks.direct + risks.bidirect + risks.line)
        const color = riskToColor(totalRisk)
        if (color !== COLORS.green) {
            segmentColors.set(sid, { color, risk: Math.round(totalRisk * 1000) / 1000 })
        }
    }

    // Propagate risk to overlapping segments (same unordered station pair).
    // Iterates a snapshot so propagated entries don't propagate again.
    const sidToSegment = new Map(segments.map((segment) => [segment.sid, segment]))
    for (const [sid, data] of [...segmentColors]) {
        const segment = sidToSegment.get(sid)
        if (!segment) continue
        const pairKey = sortedPairKey(segment.fromStationId, segment.toStationId)
        for (const overlappingSid of segmentsByStationPair.get(pairKey) ?? []) {
            segmentColors.set(overlappingSid, data)
        }
    }

    return Object.fromEntries(segmentColors)
}
