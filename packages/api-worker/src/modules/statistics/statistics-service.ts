import { and, count, eq, gte, lt, sql } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { DbConnection, reports, reportStatistics, reportStatisticsRefreshes } from '../../db'
import type { TransitNetworkDataService } from '../transit/transit-network-data-service'

export const STATISTICS_PERIODS = ['24h', '7d', '30d', 'all'] as const
export type StatisticsPeriod = (typeof STATISTICS_PERIODS)[number]

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// How far back each period reaches (null: all history) and how often its snapshot is recomputed.
export const STATISTICS_PERIOD_CONFIG: Record<StatisticsPeriod, { durationMs: number | null; refreshMs: number }> = {
    '24h': { durationMs: DAY_MS, refreshMs: HOUR_MS },
    '7d': { durationMs: 7 * DAY_MS, refreshMs: HOUR_MS },
    '30d': { durationMs: 30 * DAY_MS, refreshMs: HOUR_MS },
    all: { durationMs: null, refreshMs: DAY_MS },
}

// The hourly cron fires a little after the previous run's snapshot turns exactly one interval old,
// So without this slack it would skip every other run.
const CRON_REFRESH_SLACK_MS = 5 * 60 * 1000
// Requests only recompute once the cron is clearly behind, so they don't race it on every tick.
const REQUEST_REFRESH_GRACE_MS = 15 * 60 * 1000
// Longer than any refresh takes, so one that dies part-way only blocks the next for this long.
const REFRESH_LEASE_MS = 2 * 60 * 1000
// How long a request with no snapshot at all waits for another request's first computation.
const FIRST_SNAPSHOT_POLL_MS = 250
const FIRST_SNAPSHOT_POLLS = 40

/** Hands work to the runtime to finish after the response is sent (`waitUntil`). */
export type Defer = (work: Promise<unknown>) => void

const notQuarantined = sql`${reports.trust} IS NOT 0`

// UTC quarter-hours preserve local hour boundaries, including DST and fractional offsets.
const QUARTER_HOUR_MS = 15 * 60 * 1000
const quarterHourBucket = sql<number>`cast(${reports.timestamp} / ${sql.raw(String(QUARTER_HOUR_MS))} as integer)`

const lineStatisticsEntrySchema = z.object({
    name: z.string(),
    score: z.number().nonnegative(),
    share: z.number().min(0).max(1),
    // Score per local hour of day, 0–23.
    hours: z.array(z.number().nonnegative()).length(24),
})

export const reportStatisticsSchema = z.object({
    period: z.enum(STATISTICS_PERIODS),
    range: z.object({
        // Null for `all` when no report has been made yet.
        start: z.iso.datetime().nullable(),
        end: z.iso.datetime(),
    }),
    computedAt: z.iso.datetime(),
    timezone: z.string(),
    reportCount: z.number().int().nonnegative(),
    lines: z.array(lineStatisticsEntrySchema),
})

export type ReportStatistics = z.infer<typeof reportStatisticsSchema>

const round = (value: number) => Math.round(value * 1000) / 1000

/*
 * Local hour of a quarter-hour bucket. Converting every row through luxon dominated the all-time
 * computation, so the zone offset is looked up once per UTC hour instead: real-world offset changes
 * (DST included) happen on whole UTC hours, and working in minutes keeps fractional offsets right.
 */
const createLocalHourOf = (timezone: string) => {
    const offsetByUtcHour = new Map<number, number>()
    return (bucket: number): number => {
        const utcHour = Math.floor((bucket * QUARTER_HOUR_MS) / HOUR_MS)
        let offsetMinutes = offsetByUtcHour.get(utcHour)
        if (offsetMinutes === undefined) {
            offsetMinutes = DateTime.fromMillis(utcHour * HOUR_MS, { zone: timezone }).offset
            offsetByUtcHour.set(utcHour, offsetMinutes)
        }
        const localMinutes = (bucket * QUARTER_HOUR_MS) / 60_000 + offsetMinutes
        return ((Math.floor(localMinutes / 60) % 24) + 24) % 24
    }
}

// Highest score first; ties fall back to the key so the order is stable between refreshes.
const byScore = <T extends { score: number }>([keyA, a]: [string, T], [keyB, b]: [string, T]) => {
    if (a.score !== b.score) return b.score - a.score
    if (keyA === keyB) return 0
    return keyA < keyB ? -1 : 1
}

export class StatisticsService {
    constructor(
        private db: DbConnection,
        private transitNetworkDataService: TransitNetworkDataService,
        private timezone: string
    ) {}

    /**
     * The stored snapshot. Once the cron has fallen behind, the overdue snapshot is still served
     * straight away while a single refresh runs in the background (inline when `defer` is absent).
     * Only when there is no snapshot at all does a request wait for one to be computed.
     */
    async getStatistics(period: StatisticsPeriod, now: Date = new Date(), defer?: Defer): Promise<ReportStatistics> {
        const snapshot = await this.readSnapshot(period)
        const { refreshMs } = STATISTICS_PERIOD_CONFIG[period]
        if (snapshot !== undefined && now.getTime() - snapshot.computedAt < refreshMs + REQUEST_REFRESH_GRACE_MS) {
            return snapshot.statistics
        }

        if (snapshot !== undefined) {
            const refresh = this.refreshExclusively(period, now)
            if (defer !== undefined) {
                defer(refresh)
                return snapshot.statistics
            }
            return (await refresh) ?? snapshot.statistics
        }

        const first = await this.refreshExclusively(period, now)
        if (first !== undefined) return first
        // Another request is computing the first snapshot; piling on would only multiply the load.
        for (let poll = 0; poll < FIRST_SNAPSHOT_POLLS; poll++) {
            await new Promise((resolve) => setTimeout(resolve, FIRST_SNAPSHOT_POLL_MS))
            const computed = await this.readSnapshot(period)
            if (computed !== undefined) return computed.statistics
        }
        return this.refresh(period, now)
    }

    /** Recomputes every period whose snapshot is due; called by the hourly cron. */
    async refreshDueSnapshots(now: Date = new Date()): Promise<StatisticsPeriod[]> {
        const refreshed: StatisticsPeriod[] = []
        for (const period of STATISTICS_PERIODS) {
            const snapshot = await this.readSnapshot(period)
            const { refreshMs } = STATISTICS_PERIOD_CONFIG[period]
            if (snapshot !== undefined && now.getTime() - snapshot.computedAt < refreshMs - CRON_REFRESH_SLACK_MS) {
                continue
            }
            // Skipped when a request is already refreshing this period.
            if ((await this.refreshExclusively(period, now)) !== undefined) refreshed.push(period)
        }
        return refreshed
    }

    /** When the stored snapshot for `period` will next be replaced by the cron. */
    nextRefreshAt(statistics: ReportStatistics): Date {
        return new Date(Date.parse(statistics.computedAt) + STATISTICS_PERIOD_CONFIG[statistics.period].refreshMs)
    }

    /**
     * Refreshes `period` unless another worker already is, in which case it returns undefined. The
     * claim is a conditional upsert, so it holds across isolates and colos, not just this one.
     */
    private async refreshExclusively(period: StatisticsPeriod, now: Date): Promise<ReportStatistics | undefined> {
        const startedAt = now.getTime()
        const claimed = await this.db
            .insert(reportStatisticsRefreshes)
            .values({ period, startedAt })
            .onConflictDoUpdate({
                target: reportStatisticsRefreshes.period,
                set: { startedAt },
                setWhere: lt(reportStatisticsRefreshes.startedAt, startedAt - REFRESH_LEASE_MS),
            })
            .returning({ period: reportStatisticsRefreshes.period })
        if (claimed.length === 0) return undefined

        try {
            return await this.refresh(period, now)
        } finally {
            await this.db.delete(reportStatisticsRefreshes).where(eq(reportStatisticsRefreshes.period, period))
        }
    }

    private async refresh(period: StatisticsPeriod, now: Date): Promise<ReportStatistics> {
        const statistics = await this.computeStatistics(period, now)
        const row = { computedAt: now.getTime(), payload: JSON.stringify(statistics) }
        await this.db
            .insert(reportStatistics)
            .values({ period, ...row })
            .onConflictDoUpdate({ target: reportStatistics.period, set: row })
        return statistics
    }

    private async readSnapshot(
        period: StatisticsPeriod
    ): Promise<{ computedAt: number; statistics: ReportStatistics } | undefined> {
        const row = await this.db.select().from(reportStatistics).where(eq(reportStatistics.period, period)).get()
        if (row === undefined) return undefined
        // A snapshot written by an older deploy may not match the current shape; treat it as missing.
        const parsed = reportStatisticsSchema.safeParse(JSON.parse(row.payload))
        return parsed.success ? { computedAt: row.computedAt, statistics: parsed.data } : undefined
    }

    async computeStatistics(period: StatisticsPeriod, now: Date): Promise<ReportStatistics> {
        const { durationMs } = STATISTICS_PERIOD_CONFIG[period]
        const rangeStart = durationMs === null ? undefined : new Date(now.getTime() - durationMs)

        // Grouped in SQL so even the all-time period never loads individual reports into the Worker.
        const [rows, lines, stations] = await Promise.all([
            this.db
                .select({
                    lineId: reports.lineId,
                    stationId: reports.stationId,
                    bucket: quarterHourBucket,
                    first: sql<number>`min(${reports.timestamp})`,
                    value: count(),
                })
                .from(reports)
                .where(and(rangeStart ? gte(reports.timestamp, rangeStart) : undefined, notQuarantined))
                .groupBy(reports.lineId, reports.stationId, quarterHourBucket),
            this.transitNetworkDataService.getLines(),
            this.transitNetworkDataService.getStations(),
        ])

        const nameByLineId = new Map(lines.map((line) => [line.id, line.name]))
        const byName = new Map<string, { score: number; hours: number[] }>()
        const add = (name: string, hour: number, value: number) => {
            let entry = byName.get(name)
            if (entry === undefined) {
                entry = { score: 0, hours: Array.from({ length: 24 }, () => 0) }
                byName.set(name, entry)
            }
            entry.score += value
            entry.hours[hour]! += value
        }

        const localHourOf = createLocalHourOf(this.timezone)

        let reportCount = 0
        let first: number | undefined
        for (const row of rows) {
            reportCount += row.value
            first = first === undefined ? row.first : Math.min(first, row.first)

            /*
             * A report that names a line counts fully for it. One without a line is spread evenly
             * across every line the station serves, so a station on U2 and U3 adds half to each.
             */
            const names =
                row.lineId !== null
                    ? [nameByLineId.get(row.lineId)].filter((name) => name !== undefined)
                    : [
                          ...new Set(
                              (Object.hasOwn(stations, row.stationId) ? stations[row.stationId]!.lines : [])
                                  .map((lineId) => nameByLineId.get(lineId))
                                  .filter((name) => name !== undefined)
                          ),
                      ]
            if (names.length === 0) continue

            const hour = localHourOf(row.bucket)
            const share = row.value / names.length
            for (const name of names) add(name, hour, share)
        }

        const totalScore = [...byName.values()].reduce((sum, entry) => sum + entry.score, 0)
        const lineEntries = [...byName].sort(byScore).map(([name, entry]) => ({
            name,
            score: round(entry.score),
            share: totalScore === 0 ? 0 : round(entry.score / totalScore),
            hours: entry.hours.map(round),
        }))

        const start = rangeStart ?? (first === undefined ? null : new Date(first))
        return reportStatisticsSchema.parse({
            period,
            range: { start: start?.toISOString() ?? null, end: now.toISOString() },
            computedAt: now.toISOString(),
            timezone: this.timezone,
            reportCount,
            lines: lineEntries,
        })
    }
}
