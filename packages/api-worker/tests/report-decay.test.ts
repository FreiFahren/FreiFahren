import { describe, expect, it } from 'vitest'

import {
    annotateReportExpiry,
    BURST_REFERENCE_RATE_PER_MIN,
    burstAdaptiveTtlMs,
    burstRatePerMinute,
    CHAIN_HEAD_TTL_BOOST,
    computeChainInfo,
    computeExpiresAtMs,
    isLive,
    SUPERSEDED_FADE_MS,
    TTL_MAX_MS,
    TTL_MIN_MS,
} from '../src/modules/reports/report-decay'

const minutesAgo = (now: Date, minutes: number): Date => new Date(now.getTime() - minutes * 60_000)

const LINE_A = { id: 'line-a', stations: ['a0', 'a1', 'a2', 'a3', 'a4'] }

describe('burstRatePerMinute', () => {
    it('counts only reports inside the trailing window', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const reports = [
            { stationId: 'a0', lineId: null, timestamp: minutesAgo(now, 5) },
            { stationId: 'a1', lineId: null, timestamp: minutesAgo(now, 10) },
            { stationId: 'a2', lineId: null, timestamp: minutesAgo(now, 20) }, // outside a 15min window
        ]

        // 2 reports / 15 minutes
        expect(burstRatePerMinute(reports, now.getTime(), 15 * 60_000)).toBeCloseTo(2 / 15)
    })
})

describe('burstAdaptiveTtlMs', () => {
    it('sits exactly between the bounds at the reference rate', () => {
        expect(burstAdaptiveTtlMs(BURST_REFERENCE_RATE_PER_MIN)).toBeCloseTo((TTL_MIN_MS + TTL_MAX_MS) / 2)
    })

    it('approaches the max ttl as the rate goes to zero', () => {
        expect(burstAdaptiveTtlMs(0)).toBe(TTL_MAX_MS)
    })

    it('drops toward the min ttl as the rate grows', () => {
        expect(burstAdaptiveTtlMs(100_000)).toBeLessThan(TTL_MIN_MS + 1000)
    })
})

describe('computeChainInfo', () => {
    it('marks an earlier report as superseded once a later one appears further along the line', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const earlier = { stationId: 'a0', lineId: LINE_A.id, timestamp: minutesAgo(now, 6) }
        const later = { stationId: 'a2', lineId: LINE_A.id, timestamp: minutesAgo(now, 0) }
        const keyOf = (r: typeof earlier) => `${r.stationId}|${r.timestamp.getTime()}`

        const chainByKey = computeChainInfo([earlier, later], new Map([[LINE_A.id, LINE_A.stations]]), keyOf)

        expect(chainByKey.get(keyOf(earlier))?.isChainHead).toBe(false)
        expect(chainByKey.get(keyOf(earlier))?.supersededAtMs).toBe(later.timestamp.getTime())
        expect(chainByKey.get(keyOf(later))?.isChainHead).toBe(true)
    })

    it('does not chain reports whose gap exceeds the travel-time budget', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        // 4 hops * 3min * 2.5 slack = 30min budget; 40min gap exceeds it.
        const earlier = { stationId: 'a0', lineId: LINE_A.id, timestamp: minutesAgo(now, 40) }
        const later = { stationId: 'a4', lineId: LINE_A.id, timestamp: minutesAgo(now, 0) }
        const keyOf = (r: typeof earlier) => `${r.stationId}|${r.timestamp.getTime()}`

        const chainByKey = computeChainInfo([earlier, later], new Map([[LINE_A.id, LINE_A.stations]]), keyOf)

        expect(chainByKey.get(keyOf(earlier))?.isChainHead).toBe(true)
        expect(chainByKey.get(keyOf(earlier))?.supersededAtMs).toBeNull()
    })

    it('ignores reports on lines with no known topology', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const a = { stationId: 'x0', lineId: 'unknown-line', timestamp: minutesAgo(now, 5) }
        const b = { stationId: 'x1', lineId: 'unknown-line', timestamp: minutesAgo(now, 0) }
        const keyOf = (r: typeof a) => `${r.stationId}|${r.timestamp.getTime()}`

        const chainByKey = computeChainInfo([a, b], new Map(), keyOf)

        expect(chainByKey.get(keyOf(a))?.isChainHead).toBe(true)
        expect(chainByKey.get(keyOf(b))?.isChainHead).toBe(true)
    })
})

describe('computeExpiresAtMs', () => {
    it('expires an unchained report one full ttl after it was reported', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const chain = { supersededAtMs: null, isChainHead: false } // no chain-head boost

        // Quiet period -> base ttl == TTL_MAX_MS
        expect(computeExpiresAtMs(now.getTime(), 0, chain)).toBe(now.getTime() + TTL_MAX_MS)
    })

    it('boosts a chain head by CHAIN_HEAD_TTL_BOOST', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const baseTtl = burstAdaptiveTtlMs(0)

        const expiresAt = computeExpiresAtMs(now.getTime(), 0, { supersededAtMs: null, isChainHead: true })

        expect(expiresAt).toBeCloseTo(now.getTime() + baseTtl * CHAIN_HEAD_TTL_BOOST)
    })

    it('cuts a superseded report short, one fade window after it was overtaken', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const reportedAtMs = minutesAgo(now, 10).getTime()
        const supersededAtMs = minutesAgo(now, 4).getTime()

        const expiresAt = computeExpiresAtMs(reportedAtMs, 0, { supersededAtMs, isChainHead: false })

        expect(expiresAt).toBe(supersededAtMs + SUPERSEDED_FADE_MS)
    })

    /*
     * Being overtaken is evidence a report is stale, so it can only ever shorten a report's life.
     * A report already near the end of its ttl when it is overtaken must not have its life extended
     * out to the fade window.
     */
    it('never lets being superseded extend a report past its own ttl', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const chain = { supersededAtMs: now.getTime(), isChainHead: false }
        // Reported a full ttl ago, so its own expiry is now — before the fade window would end.
        const reportedAtMs = now.getTime() - TTL_MAX_MS

        expect(computeExpiresAtMs(reportedAtMs, 0, chain)).toBe(now.getTime())
    })
})

describe('annotateReportExpiry', () => {
    it('stamps every report with its expiry without dropping any of them', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const reports = [
            { stationId: 'a0', lineId: null, timestamp: minutesAgo(now, 0) },
            { stationId: 'a1', lineId: null, timestamp: minutesAgo(now, 70) }, // long past any ttl
        ]

        const result = annotateReportExpiry(reports, [LINE_A], now.getTime())

        expect(result).toHaveLength(2)
        expect(isLive(result[0]!, now.getTime())).toBe(true)
        expect(isLive(result[1]!, now.getTime())).toBe(false)
    })

    /*
     * The 24h line/station panels and the 7d station counter read the same endpoint as the map.
     * Every report in those windows is older than any ttl, so annotating (rather than dropping)
     * is what keeps those views populated.
     */
    it('returns long-expired reports so historical windows stay populated', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const reports = [
            { stationId: 'a0', lineId: LINE_A.id, timestamp: minutesAgo(now, 120) },
            { stationId: 'a2', lineId: LINE_A.id, timestamp: minutesAgo(now, 126) },
        ]

        const result = annotateReportExpiry(reports, [LINE_A], now.getTime())

        expect(result).toHaveLength(2)
        expect(result.every((report) => isLive(report, now.getTime()))).toBe(false)
    })

    it('expires the earlier report of a chain sooner than an equally-aged, unchained one', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const supersededStation = { stationId: 'a0', lineId: LINE_A.id, timestamp: minutesAgo(now, 6) }
        const chainHead = { stationId: 'a2', lineId: LINE_A.id, timestamp: minutesAgo(now, 0) }
        const unchained = { stationId: 'a0', lineId: null, timestamp: minutesAgo(now, 6) }

        const result = annotateReportExpiry([supersededStation, chainHead, unchained], [LINE_A], now.getTime())

        const supersededExpiry = result.find((r) => r.lineId === LINE_A.id && r.stationId === 'a0')!.expiresAt
        const unchainedExpiry = result.find((r) => r.lineId === null)!.expiresAt

        expect(supersededExpiry.getTime()).toBeLessThan(unchainedExpiry.getTime())
    })
})
