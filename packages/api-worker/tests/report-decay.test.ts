import { describe, expect, it } from 'vitest'

import {
    applyReportDecay,
    BURST_REFERENCE_RATE_PER_MIN,
    burstAdaptiveTtlMs,
    burstRatePerMinute,
    CHAIN_HEAD_TTL_BOOST,
    computeChainInfo,
    computeReportDecay,
    MIN_OPACITY,
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

describe('computeReportDecay', () => {
    it('is fully opaque for a brand-new, unchained report', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const { opacity, dropped } = computeReportDecay(now.getTime(), now.getTime(), 0)

        expect(opacity).toBe(1)
        expect(dropped).toBe(false)
    })

    it('drops a report once its age reaches the ttl', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const ratePerMinute = 0 // quiet -> base ttl == TTL_MAX_MS
        const chain = { supersededAtMs: null, isChainHead: false } // no chain-head boost, so ttl == TTL_MAX_MS
        const timestampMs = now.getTime() - TTL_MAX_MS

        const { opacity, dropped } = computeReportDecay(timestampMs, now.getTime(), ratePerMinute, chain)

        expect(dropped).toBe(true)
        expect(opacity).toBe(0)
    })

    it('never fades below MIN_OPACITY while still inside its ttl', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const ratePerMinute = 0
        const almostExpiredMs = now.getTime() - (TTL_MAX_MS - 1)

        const { opacity, dropped } = computeReportDecay(almostExpiredMs, now.getTime(), ratePerMinute)

        expect(dropped).toBe(false)
        expect(opacity).toBeGreaterThanOrEqual(MIN_OPACITY)
    })

    it('boosts the ttl of a chain head by CHAIN_HEAD_TTL_BOOST', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const ratePerMinute = 0
        const baseTtl = burstAdaptiveTtlMs(ratePerMinute)

        const { ttlMs } = computeReportDecay(now.getTime(), now.getTime(), ratePerMinute, {
            supersededAtMs: null,
            isChainHead: true,
        })

        expect(ttlMs).toBeCloseTo(baseTtl * CHAIN_HEAD_TTL_BOOST)
    })

    it('fades a superseded report out quickly, independent of its normal ttl', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const supersededAtMs = now.getTime() - SUPERSEDED_FADE_MS / 2

        const { opacity, dropped } = computeReportDecay(now.getTime() - 60_000, now.getTime(), 0, {
            supersededAtMs,
            isChainHead: false,
        })

        expect(dropped).toBe(false)
        expect(opacity).toBeCloseTo(MIN_OPACITY * 0.5)
        expect(opacity).toBeLessThan(MIN_OPACITY)
    })

    it('drops a superseded report once the fade window has fully elapsed', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const supersededAtMs = now.getTime() - SUPERSEDED_FADE_MS

        const { opacity, dropped } = computeReportDecay(now.getTime() - 60_000, now.getTime(), 0, {
            supersededAtMs,
            isChainHead: false,
        })

        expect(dropped).toBe(true)
        expect(opacity).toBe(0)
    })
})

describe('applyReportDecay', () => {
    it('drops expired reports and attaches opacity to the ones that survive', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const reports = [
            { stationId: 'a0', lineId: null, timestamp: minutesAgo(now, 0) },
            { stationId: 'a1', lineId: null, timestamp: minutesAgo(now, 120) }, // well past TTL_MAX_MS
        ]

        const result = applyReportDecay(reports, [LINE_A], now.getTime())

        expect(result).toHaveLength(1)
        expect(result[0]!.stationId).toBe('a0')
        expect(result[0]!.opacity).toBeGreaterThan(0)
    })

    it('fades out the earlier report of a chain faster than an equally-aged, unchained one', () => {
        const now = new Date('2024-01-15T12:00:00Z')
        const supersededStation = { stationId: 'a0', lineId: LINE_A.id, timestamp: minutesAgo(now, 6) }
        const chainHead = { stationId: 'a2', lineId: LINE_A.id, timestamp: minutesAgo(now, 0) }
        const unchained = { stationId: 'a0', lineId: null, timestamp: minutesAgo(now, 6) }

        const result = applyReportDecay([supersededStation, chainHead, unchained], [LINE_A], now.getTime())

        const supersededOpacity = result.find((r) => r.lineId === LINE_A.id && r.stationId === 'a0')!.opacity
        const unchainedOpacity = result.find((r) => r.lineId === null)!.opacity

        expect(supersededOpacity).toBeLessThan(unchainedOpacity)
    })
})
