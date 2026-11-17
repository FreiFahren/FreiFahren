import { eq } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { calculatePredictedReportsThreshold } from '../src/modules/reports/reports-service'
import { db, lineStations, lines, reports } from './test-db'
import { appRequestWithRedirect, sendReportRequest, setSystemTime } from './test-utils'

type Report = {
    stationId: string
    timestamp: string
    isPredicted: boolean
    expiresAt: string | null
}

describe('Prediction fallback after report expiry', () => {
    let lineId: string
    let expiredStationId: string
    let liveStationId: string

    beforeAll(async () => {
        const [line] = await db.select({ id: lines.id }).from(lines).limit(1)
        lineId = line.id
        const stations = await db
            .select({ stationId: lineStations.stationId })
            .from(lineStations)
            .where(eq(lineStations.lineId, lineId))
            .limit(2)
        expiredStationId = stations[0].stationId
        liveStationId = stations[1].stationId
    })

    beforeEach(async () => {
        await db.delete(reports)
    })

    afterEach(async () => {
        await db.delete(reports)
        setSystemTime()
    })

    const submitAt = async (time: DateTime, stationId = expiredStationId) => {
        setSystemTime(time.toJSDate())
        expect((await sendReportRequest({ stationId, lineId, source: 'web_app' })).status).toBe(200)
    }

    const seedHistory = async (now: DateTime) => {
        for (const minutes of [40, 45, 50]) {
            await submitAt(now.minus({ weeks: 1, minutes }))
        }
    }

    const query = async (
        now: DateTime,
        from?: DateTime,
        to?: DateTime,
        stationId?: string,
        mode: 'live' | 'history' = 'live'
    ) => {
        setSystemTime(now.toJSDate())
        const params = new URLSearchParams({ mode })
        if (from && to) {
            params.set('from', from.toUTC().toISO()!)
            params.set('to', to.toUTC().toISO()!)
        }
        const response = await appRequestWithRedirect(`/reports${stationId ? `/${stationId}` : ''}?${params}`)
        expect(response.status).toBe(200)
        return (await response.json()) as Report[]
    }

    it.each(['city', 'station'])('fills the nighttime quota despite an expired report (%s query)', async (mode) => {
        const now = DateTime.fromISO('2024-01-15T23:30:00', { zone: 'Europe/Berlin' })
        expect(calculatePredictedReportsThreshold(now)).toBe(1)
        await seedHistory(now)
        await submitAt(now.minus({ minutes: 58 }))

        const body = await query(now, undefined, undefined, mode === 'station' ? expiredStationId : undefined)

        const real = body.filter((report) => !report.isPredicted)
        expect(real).toHaveLength(1)
        expect(new Date(real[0].expiresAt!).getTime()).toBeLessThanOrEqual(now.toMillis())
        expect(body.filter((report) => report.isPredicted)).toEqual([
            expect.objectContaining({ stationId: expiredStationId, expiresAt: null }),
        ])
    })

    it('counts only the live reports toward a mixed live/expired quota', async () => {
        const now = DateTime.fromISO('2024-01-15T07:30:00', { zone: 'Europe/Berlin' })
        expect(calculatePredictedReportsThreshold(now)).toBe(2)
        await seedHistory(now)
        await submitAt(now.minus({ minutes: 58 }))
        await submitAt(now.minus({ minutes: 1 }), liveStationId)

        const body = await query(now)
        const real = body.filter((report) => !report.isPredicted)
        expect(real).toHaveLength(2)
        expect(real.filter((report) => new Date(report.expiresAt!).getTime() > now.toMillis())).toEqual([
            expect.objectContaining({ stationId: liveStationId }),
        ])
        expect(body.filter((report) => report.isPredicted)).toEqual([
            expect.objectContaining({ stationId: expiredStationId }),
        ])
    })

    it('keeps live real reports satisfying the quota', async () => {
        const now = DateTime.fromISO('2024-01-15T23:30:00', { zone: 'Europe/Berlin' })
        await seedHistory(now)
        await submitAt(now.minus({ minutes: 1 }), liveStationId)

        const body = await query(now)
        expect(body).toEqual([expect.objectContaining({ stationId: liveStationId, isPredicted: false })])
        expect(new Date(body[0].expiresAt!).getTime()).toBeGreaterThan(now.toMillis())
    })

    it.each(['past hour', '24 hours', '7 days'])(
        'preserves expired reports and the real-report quota in historical queries (%s)',
        async (window) => {
            const now = DateTime.fromISO('2024-01-15T07:30:00', { zone: 'Europe/Berlin' })
            await seedHistory(now)
            await submitAt(now.minus({ hours: 2, minutes: 10 }), liveStationId)
            await submitAt(now.minus({ hours: 2, minutes: 20 }), liveStationId)
            const from =
                window === 'past hour'
                    ? now.minus({ hours: 3 })
                    : now.minus(window === '24 hours' ? { hours: 24 } : { days: 7 })
            const to = window === 'past hour' ? now.minus({ hours: 2 }) : now

            const body = await query(now, from, to, undefined, 'history')
            expect(body).toHaveLength(2)
            expect(body.every((report) => !report.isPredicted)).toBe(true)
            expect(body.every((report) => new Date(report.expiresAt!).getTime() <= now.toMillis())).toBe(true)
        }
    )

    it.each(['history', 'omitted'] as const)(
        'keeps expired last-hour observations counting for history (mode %s)',
        async (mode) => {
            const now = DateTime.fromISO('2024-01-15T23:30:00', { zone: 'Europe/Berlin' })
            await seedHistory(now)
            await submitAt(now.minus({ minutes: 58 }))
            const live = await query(now)
            expect(live.some((report) => report.isPredicted)).toBe(true)
            const params = new URLSearchParams({
                from: now.minus({ hours: 1 }).toUTC().toISO()!,
                to: now.toUTC().toISO()!,
            })
            if (mode === 'history') params.set('mode', mode)
            const response = await appRequestWithRedirect(`/reports?${params}`)
            expect(response.status).toBe(200)
            expect(await response.json()).toEqual(live.filter((report) => !report.isPredicted))
        }
    )

    it('keeps station history independent of the station live fallback', async () => {
        const now = DateTime.fromISO('2024-01-15T23:30:00', { zone: 'Europe/Berlin' })
        await seedHistory(now)
        await submitAt(now.minus({ minutes: 58 }))
        const live = await query(now, undefined, undefined, expiredStationId)
        const history = await query(now, now.minus({ days: 7 }), now, expiredStationId, 'history')
        expect(live.some((report) => report.isPredicted)).toBe(true)
        expect(history).toEqual(live.filter((report) => !report.isPredicted))
    })

    it('preserves fallback for a genuinely empty historical window', async () => {
        const now = DateTime.fromISO('2024-01-15T23:30:00', { zone: 'Europe/Berlin' })
        await seedHistory(now)
        const history = await query(now, now.minus({ hours: 1 }), now, undefined, 'history')
        expect(history).toHaveLength(1)
        expect(history[0].isPredicted).toBe(true)
    })

    it('uses the server range for live requests and retains older observations in history', async () => {
        const now = DateTime.fromISO('2024-01-15T23:30:00', { zone: 'Europe/Berlin' })
        await seedHistory(now)
        await submitAt(now.minus({ minutes: 62 }), liveStationId)
        await submitAt(now.minus({ minutes: 58 }))
        const live = await query(now)
        expect(live.filter((report) => !report.isPredicted)).toHaveLength(1)
        expect(live.some((report) => report.isPredicted)).toBe(true)
        const history = await query(now, now.minus({ hours: 24 }), now, undefined, 'history')
        expect(history).toHaveLength(2)
        expect(history.every((report) => !report.isPredicted)).toBe(true)
    })

    it.each(['from', 'to', 'both'])('rejects client timestamps in live mode (%s)', async (timestamps) => {
        const now = DateTime.utc(2024, 1, 15, 23, 30)
        const params = new URLSearchParams({ mode: 'live' })
        if (timestamps !== 'to') params.set('from', now.minus({ hours: 1 }).toISO()!)
        if (timestamps !== 'from') params.set('to', now.plus({ seconds: 90 }).toISO()!)
        for (const path of ['/reports', `/reports/${expiredStationId}`]) {
            expect((await appRequestWithRedirect(`${path}?${params}`)).status).toBe(400)
        }
    })
})
