import { and, count, gte, sql } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { DbConnection, reports } from '../../db'
import type { TransitNetworkDataService } from '../transit/transit-network-data-service'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// Capped at 30 days: longer windows would group too much history on every cache miss.
export const REPORT_SUMMARY_PERIODS = ['24h', '7d', '30d'] as const
export type ReportSummaryPeriod = (typeof REPORT_SUMMARY_PERIODS)[number]

const PERIOD_DURATION_MS: Record<ReportSummaryPeriod, number> = {
    '24h': DAY_MS,
    '7d': 7 * DAY_MS,
    '30d': 30 * DAY_MS,
}

// UTC quarter-hours preserve local hour boundaries, including DST and fractional offsets.
const QUARTER_HOUR_MS = 15 * 60 * 1000
const quarterHourBucket = sql<number>`cast(${reports.timestamp} / ${sql.raw(String(QUARTER_HOUR_MS))} as integer)`

export const reportSummarySchema = z.object({
    period: z.enum(REPORT_SUMMARY_PERIODS),
    range: z.object({
        start: z.iso.datetime(),
        end: z.iso.datetime(),
    }),
    timezone: z.string(),
    reportCount: z.number().int().nonnegative(),
    lines: z.array(
        z.object({
            name: z.string(),
            score: z.number().nonnegative(),
            share: z.number().min(0).max(1),
            // Score per local hour of day, 0–23.
            hours: z.array(z.number().nonnegative()).length(24),
        })
    ),
})

export type ReportSummary = z.infer<typeof reportSummarySchema>

const round = (value: number) => Math.round(value * 1000) / 1000

// Real-world offset changes (DST included) happen on whole UTC hours, so the zone lookup is done
// Once per UTC hour rather than once per row; minutes keep fractional offsets right.
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

// Highest score first; ties fall back to the name so the order is stable between cache refreshes.
const byScore = <T extends { score: number }>([nameA, a]: [string, T], [nameB, b]: [string, T]) => {
    if (a.score !== b.score) return b.score - a.score
    if (nameA === nameB) return 0
    return nameA < nameB ? -1 : 1
}

export const computeReportSummary = async (
    db: DbConnection,
    transitNetworkDataService: TransitNetworkDataService,
    timezone: string,
    period: ReportSummaryPeriod,
    now: Date
): Promise<ReportSummary> => {
    const rangeStart = new Date(now.getTime() - PERIOD_DURATION_MS[period])

    // Grouped in SQL so a busy month never loads individual reports into the Worker.
    const [rows, lines, stations] = await Promise.all([
        db
            .select({
                lineId: reports.lineId,
                stationId: reports.stationId,
                bucket: quarterHourBucket,
                value: count(),
            })
            .from(reports)
            .where(and(gte(reports.timestamp, rangeStart), sql`${reports.trust} IS NOT 0`))
            .groupBy(reports.lineId, reports.stationId, quarterHourBucket),
        transitNetworkDataService.getLines(),
        transitNetworkDataService.getStations(),
    ])

    const nameByLineId = new Map(lines.map((line) => [line.id, line.name]))
    const byName = new Map<string, { score: number; hours: number[] }>()
    const localHourOf = createLocalHourOf(timezone)

    let reportCount = 0
    for (const row of rows) {
        reportCount += row.value

        // A report naming a line counts fully for it. One without a line is spread evenly across
        // Every line the station serves, so a station on U2 and U3 adds half to each.
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
        for (const name of names) {
            let entry = byName.get(name)
            if (entry === undefined) {
                entry = { score: 0, hours: Array.from({ length: 24 }, () => 0) }
                byName.set(name, entry)
            }
            entry.score += share
            entry.hours[hour]! += share
        }
    }

    const totalScore = [...byName.values()].reduce((sum, entry) => sum + entry.score, 0)
    return reportSummarySchema.parse({
        period,
        range: { start: rangeStart.toISOString(), end: now.toISOString() },
        timezone,
        reportCount,
        lines: [...byName].sort(byScore).map(([name, entry]) => ({
            name,
            score: round(entry.score),
            share: totalScore === 0 ? 0 : round(entry.score / totalScore),
            hours: entry.hours.map(round),
        })),
    })
}
