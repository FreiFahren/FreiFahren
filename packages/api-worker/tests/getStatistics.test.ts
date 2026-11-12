import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { asc, eq } from 'drizzle-orm'

import { reportStatisticsSchema, type ReportStatistics } from '../src/modules/statistics'
import { refreshReportStatisticsForAllCities } from '../src/modules/statistics/statistics-refresh'
import { db, lines, lineStations, reports, reportStatistics, reportStatisticsRefreshes } from './test-db'
import {
    appRequestWithRedirect,
    fakeReportGate,
    resetTestEnv,
    sendReportRequest,
    setSystemTime,
    setTestEnv,
    testEnv,
} from './test-utils'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// A station served by a single line name, and one shared by at least two line names.
let singleLine: { stationId: string; lineId: string; lineName: string }
let sharedStation: { stationId: string; lineNames: string[] }
// The stations of a line with a single, non-circular variant, in line order.
let straightLine: { lineId: string; lineName: string; stations: string[] }
// Two neighbouring stations that more than one line runs between.
let sharedTrack: { stationId: string; neighbourId: string; lines: Array<{ id: string; name: string }> }

const reportAt = async (timestamp: Date, report: { stationId: string; lineId?: string; directionId?: string }) => {
    setSystemTime(timestamp)
    expect((await sendReportRequest({ ...report, source: 'web_app' })).status).toBe(200)
}

const getStatistics = async (period?: string) => {
    const response = await appRequestWithRedirect(`/statistics${period ? `?period=${period}` : ''}`)
    expect(response.status).toBe(200)
    return { response, body: reportStatisticsSchema.parse(await response.json()) }
}

const scoreOf = (statistics: ReportStatistics, name: string) =>
    statistics.lines.find((line) => line.name === name)?.score ?? 0

beforeAll(async () => {
    const rows = await db
        .select({ stationId: lineStations.stationId, lineId: lines.id, lineName: lines.name })
        .from(lineStations)
        .innerJoin(lines, eq(lines.id, lineStations.lineId))
    const namesByStation = new Map<string, Set<string>>()
    for (const row of rows) {
        const names = namesByStation.get(row.stationId) ?? new Set()
        names.add(row.lineName)
        namesByStation.set(row.stationId, names)
    }

    const single = rows.find((row) => namesByStation.get(row.stationId)!.size === 1)
    const shared = [...namesByStation].find(([, names]) => names.size >= 2)
    if (!single || !shared) throw new Error('Expected seeded data with single-line and shared stations')
    singleLine = single
    sharedStation = { stationId: shared[0], lineNames: [...shared[1]] }

    const seededLines = await db.select().from(lines)
    const straight = seededLines.find(
        (line) => !line.isCircular && seededLines.filter((other) => other.name === line.name).length === 1
    )
    if (!straight) throw new Error('Expected seeded data with a single-variant linear line')
    const ordered = await db
        .select({ stationId: lineStations.stationId })
        .from(lineStations)
        .where(eq(lineStations.lineId, straight.id))
        .orderBy(asc(lineStations.order))
    straightLine = { lineId: straight.id, lineName: straight.name, stations: ordered.map((row) => row.stationId) }

    const allOrdered = await db
        .select({ lineId: lineStations.lineId, stationId: lineStations.stationId })
        .from(lineStations)
        .orderBy(asc(lineStations.lineId), asc(lineStations.order))
    const linesByPair = new Map<string, Map<string, { id: string; name: string }>>()
    for (let i = 1; i < allOrdered.length; i++) {
        const [previous, current] = [allOrdered[i - 1]!, allOrdered[i]!]
        if (previous.lineId !== current.lineId) continue
        const name = seededLines.find((line) => line.id === current.lineId)!.name
        const pair = [previous.stationId, current.stationId].sort().join('|')
        const byName = linesByPair.get(pair) ?? new Map()
        if (!byName.has(name)) byName.set(name, { id: current.lineId, name })
        linesByPair.set(pair, byName)
    }
    const sharedPair = [...linesByPair].find(([, byName]) => byName.size >= 2)
    if (!sharedPair) throw new Error('Expected seeded data with two lines sharing a stretch of track')
    const [stationId, neighbourId] = sharedPair[0].split('|') as [string, string]
    sharedTrack = { stationId, neighbourId, lines: [...sharedPair[1].values()].slice(0, 2) }
})

beforeEach(async () => {
    await db.delete(reports)
    await db.delete(reportStatistics)
    await db.delete(reportStatisticsRefreshes)
})

afterEach(async () => {
    await db.delete(reports)
    await db.delete(reportStatistics)
    await db.delete(reportStatisticsRefreshes)
    setSystemTime()
    resetTestEnv()
})

describe('GET /statistics', () => {
    it('ranks lines, splitting reports without a line across the station lines', async () => {
        const now = new Date('2026-07-15T12:00:00.000Z')
        await reportAt(new Date(now.getTime() - 2 * HOUR_MS), { stationId: singleLine.stationId })
        await reportAt(new Date(now.getTime() - HOUR_MS), { stationId: singleLine.stationId })
        await reportAt(new Date(now.getTime() - HOUR_MS), { stationId: sharedStation.stationId })
        setSystemTime(now)

        const { body } = await getStatistics('24h')

        expect(body.reportCount).toBe(3)
        expect(body.range).toEqual({ start: new Date(now.getTime() - DAY_MS).toISOString(), end: now.toISOString() })
        expect(body.lines[0]!.name).toBe(singleLine.lineName)
        expect(scoreOf(body, singleLine.lineName)).toBeGreaterThanOrEqual(2)
        const split = 1 / sharedStation.lineNames.length
        for (const name of sharedStation.lineNames.filter((name) => name !== singleLine.lineName)) {
            expect(scoreOf(body, name)).toBeCloseTo(split, 3)
        }
        expect(body.lines.reduce((sum, line) => sum + line.share, 0)).toBeCloseTo(1, 2)
    })

    it('defaults to 24h and limits each period to its window', async () => {
        const now = new Date('2026-07-15T12:00:00.000Z')
        const firstReport = new Date(now.getTime() - 40 * DAY_MS)
        await reportAt(firstReport, { stationId: singleLine.stationId })
        await reportAt(new Date(now.getTime() - 10 * DAY_MS), { stationId: singleLine.stationId })
        await reportAt(new Date(now.getTime() - 3 * DAY_MS), { stationId: singleLine.stationId })
        await reportAt(new Date(now.getTime() - HOUR_MS), { stationId: singleLine.stationId })
        setSystemTime(now)

        expect((await getStatistics()).body).toMatchObject({ period: '24h', reportCount: 1 })
        expect((await getStatistics('7d')).body.reportCount).toBe(2)
        expect((await getStatistics('30d')).body.reportCount).toBe(3)
        const all = (await getStatistics('all')).body
        expect(all.reportCount).toBe(4)
        expect(all.range.start).toBe(firstReport.toISOString())
    })

    it('buckets hours in the city timezone', async () => {
        // 15:30 UTC is 17:30 in Berlin summer time.
        await reportAt(new Date('2026-07-15T15:30:00.000Z'), { stationId: singleLine.stationId })
        setSystemTime(new Date('2026-07-15T16:00:00.000Z'))

        const { body } = await getStatistics('24h')

        const hours = body.lines.find((line) => line.name === singleLine.lineName)!.hours
        expect(hours[17]).toBe(1)
        expect(hours.reduce((sum, value) => sum + value, 0)).toBe(1)
    })

    it('keeps local hours right across the daylight saving switch', async () => {
        // Berlin moves from UTC+1 to UTC+2 at 01:00 UTC on 2026-03-29.
        await reportAt(new Date('2026-03-29T00:30:00.000Z'), { stationId: singleLine.stationId })
        await reportAt(new Date('2026-03-29T01:30:00.000Z'), { stationId: singleLine.stationId })
        setSystemTime(new Date('2026-03-29T12:00:00.000Z'))

        const { body } = await getStatistics('24h')

        const hours = body.lines.find((line) => line.name === singleLine.lineName)!.hours
        expect(hours[1]).toBe(1)
        expect(hours[3]).toBe(1)
    })

    it('leaves quarantined reports out', async () => {
        const now = new Date('2026-07-15T12:00:00.000Z')
        fakeReportGate.intakeTrust = 0
        await reportAt(new Date(now.getTime() - HOUR_MS), { stationId: singleLine.stationId })
        setSystemTime(now)

        const { body } = await getStatistics('24h')

        expect(body.reportCount).toBe(0)
        expect(body.lines).toEqual([])
    })

    it('serves the stored snapshot until it is due and lets the edge cache it until then', async () => {
        const computedAt = new Date('2026-07-15T12:07:00.000Z')
        setSystemTime(computedAt)
        expect((await getStatistics('24h')).body.reportCount).toBe(0)

        await reportAt(new Date(computedAt.getTime() + 10 * 60 * 1000), { stationId: singleLine.stationId })
        setSystemTime(new Date(computedAt.getTime() + 30 * 60 * 1000))
        const { response, body } = await getStatistics('24h')

        expect(body.reportCount).toBe(0)
        expect(body.computedAt).toBe(computedAt.toISOString())
        expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('public, max-age=1800')
    })

    it('recomputes on request once the cron has fallen behind', async () => {
        const computedAt = new Date('2026-07-15T12:07:00.000Z')
        setSystemTime(computedAt)
        await getStatistics('24h')
        await reportAt(new Date(computedAt.getTime() + 10 * 60 * 1000), { stationId: singleLine.stationId })

        setSystemTime(new Date(computedAt.getTime() + 2 * HOUR_MS))
        expect((await getStatistics('24h')).body.reportCount).toBe(1)
    })

    it('serves an overdue snapshot at once and refreshes it after the response', async () => {
        const computedAt = new Date('2026-07-15T12:07:00.000Z')
        setSystemTime(computedAt)
        await getStatistics('24h')
        await reportAt(new Date(computedAt.getTime() + 10 * 60 * 1000), { stationId: singleLine.stationId })
        setSystemTime(new Date(computedAt.getTime() + 2 * HOUR_MS))

        const ctx = createExecutionContext()
        const response = await appRequestWithRedirect('/statistics?period=24h', undefined, undefined, ctx)
        const overdue = reportStatisticsSchema.parse(await response.json())
        expect(overdue.computedAt).toBe(computedAt.toISOString())
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('public, max-age=60')

        await waitOnExecutionContext(ctx)
        expect((await getStatistics('24h')).body.reportCount).toBe(1)
    })

    it('computes a missing snapshot once for parallel requests and releases the lock', async () => {
        setSystemTime(new Date('2026-07-15T12:00:00.000Z'))

        const bodies = await Promise.all([getStatistics('7d'), getStatistics('7d'), getStatistics('7d')])

        expect(new Set(bodies.map(({ body }) => body.computedAt)).size).toBe(1)
        expect(await db.select().from(reportStatistics)).toHaveLength(1)
        expect(await db.select().from(reportStatisticsRefreshes)).toEqual([])
    })

    it('skips the edge cache while public edge caching is disabled', async () => {
        setTestEnv({ PUBLIC_EDGE_CACHE_DISABLED: 'true' })

        const { response } = await getStatistics('24h')

        expect(response.headers.get('Cache-Control')).toBe('no-store')
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store')
    })

    it('rejects periods other than the fixed ones', async () => {
        const response = await appRequestWithRedirect('/statistics?period=3d')

        expect(response.status).toBe(400)
    })
})

describe('GET /statistics sections', () => {
    const sectionScore = (statistics: ReportStatistics, from: string, to: string) =>
        statistics.sections.find((section) => section.from.id === from && section.to.id === to)?.score ?? 0

    it('splits a report across both neighbouring sections, whatever its direction', async () => {
        const [first, second, third] = straightLine.stations
        const now = new Date('2026-07-15T12:00:00.000Z')
        await reportAt(new Date(now.getTime() - 2 * HOUR_MS), { stationId: second!, lineId: straightLine.lineId })
        await reportAt(new Date(now.getTime() - HOUR_MS), {
            stationId: second!,
            lineId: straightLine.lineId,
            directionId: straightLine.stations.at(-1)!,
        })
        setSystemTime(now)

        const { body } = await getStatistics('24h')

        expect(body.sections).toEqual([
            expect.objectContaining({ from: expect.objectContaining({ id: first }), score: 1, share: 0.5 }),
            expect.objectContaining({ from: expect.objectContaining({ id: second }), score: 1, share: 0.5 }),
        ])
        expect(sectionScore(body, second!, third!)).toBe(1)
        expect(body.sections[0]!.from.name).not.toBe(first)
    })

    it('gives a terminus its only section in full and ranks sections by score', async () => {
        const [first, second, third] = straightLine.stations
        const now = new Date('2026-07-15T12:00:00.000Z')
        await reportAt(new Date(now.getTime() - 2 * HOUR_MS), { stationId: first!, lineId: straightLine.lineId })
        await reportAt(new Date(now.getTime() - HOUR_MS), { stationId: second!, lineId: straightLine.lineId })
        setSystemTime(now)

        const { body } = await getStatistics('24h')

        expect(body.sections.map((section) => [section.from.id, section.to.id, section.score])).toEqual([
            [first, second, 1.5],
            [second, third, 0.5],
        ])
    })
})

describe('GET /statistics shared track', () => {
    it('merges lines running between the same two stations into one section', async () => {
        const [first, second] = sharedTrack.lines
        const now = new Date('2026-07-15T12:00:00.000Z')
        await reportAt(new Date(now.getTime() - 2 * HOUR_MS), { stationId: sharedTrack.stationId, lineId: first!.id })
        await reportAt(new Date(now.getTime() - HOUR_MS), { stationId: sharedTrack.stationId, lineId: second!.id })
        setSystemTime(now)

        const { body } = await getStatistics('24h')

        const matching = body.sections.filter(
            (section) =>
                [section.from.id, section.to.id].sort().join('|') ===
                [sharedTrack.stationId, sharedTrack.neighbourId].sort().join('|')
        )
        expect(matching).toHaveLength(1)
        const [section] = matching
        expect(section!.lines.map((line) => line.name).sort()).toEqual([first!.name, second!.name].sort())
        expect(section!.score).toBeCloseTo(
            section!.lines.reduce((sum, line) => sum + line.score, 0),
            3
        )
    })
})

describe('report statistics cron', () => {
    it('refreshes the hourly periods every run and all-time once a day', async () => {
        const firstRun = new Date('2026-07-15T12:07:00.000Z')
        await refreshReportStatisticsForAllCities(testEnv(), firstRun)
        await reportAt(new Date(firstRun.getTime() + 10 * 60 * 1000), { stationId: singleLine.stationId })

        // The next hourly run fires slightly less than an hour after the snapshot was taken.
        const nextRun = new Date(firstRun.getTime() + HOUR_MS - 30 * 1000)
        await refreshReportStatisticsForAllCities(testEnv(), nextRun)
        setSystemTime(nextRun)

        expect((await getStatistics('24h')).body).toMatchObject({
            reportCount: 1,
            computedAt: nextRun.toISOString(),
        })
        expect((await getStatistics('all')).body).toMatchObject({
            reportCount: 0,
            computedAt: firstRun.toISOString(),
        })
    })
})
