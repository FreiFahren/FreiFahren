import { count, eq, gte } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { AppError } from '../../common/errors'
import { DbConnection, reports } from '../../db'
import type { TransitNetworkDataService } from '../transit/transit-network-data-service'
import type { StationId } from '../transit/types'

const STATION_PROFILE_MINIMUM_REPORTS = 250
const LINE_PROFILE_MINIMUM_REPORTS = 1500
const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000

const rangeSchema = z.object({
    start: z.iso.datetime(),
    end: z.iso.datetime(),
})

export const stationInsightsSchema = z.object({
    stationId: z.string(),
    generatedAt: z.iso.datetime(),
    timezone: z.string(),
    scope: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('station'), stationId: z.string() }),
        z.object({ kind: z.literal('line'), lineId: z.string() }),
        z.object({ kind: z.literal('city'), city: z.string() }),
    ]),
    profile: z.object({
        sourceRange: rangeSchema,
        bucket: z.object({
            unit: z.literal('hour'),
            partition: z.literal('dayOfWeek'),
        }),
        values: z
            .array(
                z.object({
                    dayOfWeek: z.union([
                        z.literal(1),
                        z.literal(2),
                        z.literal(3),
                        z.literal(4),
                        z.literal(5),
                        z.literal(6),
                        z.literal(7),
                    ]),
                    hour: z.number().int().min(0).max(23),
                    reportCount: z.number().int().nonnegative(),
                })
            )
            .length(168),
    }),
    reportCount: z.object({
        value: z.number().int().nonnegative(),
        range: rangeSchema,
    }),
    ranking: z.object({
        position: z.number().int().positive(),
        population: z.number().int().positive(),
        metric: z.object({
            name: z.literal('reports'),
            aggregation: z.literal('count'),
            range: rangeSchema,
        }),
    }),
})

export type StationInsights = z.infer<typeof stationInsightsSchema>

type ProfileReport = {
    timestamp: Date
}

const toIso = (date: Date) => date.toISOString()

const earliestTimestamp = (values: readonly ProfileReport[], fallback: Date) => {
    const earliest = values.reduce<Date | undefined>(
        (current, value) => (current === undefined || value.timestamp < current ? value.timestamp : current),
        undefined
    )
    return earliest ?? fallback
}

export const resolveProfileScope = ({
    stationId,
    stationLines,
    stationReportCount,
    lineReportCount,
    citySlug,
}: {
    stationId: string
    stationLines: readonly string[]
    stationReportCount: number
    lineReportCount?: number
    citySlug: string
}): StationInsights['scope'] => {
    if (stationReportCount >= STATION_PROFILE_MINIMUM_REPORTS) {
        return { kind: 'station', stationId }
    }

    const [lineId] = stationLines
    if (stationLines.length === 1 && (lineReportCount ?? 0) >= LINE_PROFILE_MINIMUM_REPORTS) {
        return { kind: 'line', lineId }
    }

    return { kind: 'city', city: citySlug }
}

export class InsightsService {
    constructor(
        private db: DbConnection,
        private transitNetworkDataService: TransitNetworkDataService,
        private citySlug: string,
        private timezone: string
    ) {}

    async getStationInsights(stationId: StationId, now: Date = new Date()): Promise<StationInsights> {
        const stations = await this.transitNetworkDataService.getStations()

        if (!Object.hasOwn(stations, stationId)) {
            throw new AppError({
                message: 'Station not found',
                statusCode: 404,
                internalCode: 'STATION_NOT_FOUND',
                description: `stationId=${stationId}`,
            })
        }
        const station = stations[stationId]

        const countRangeStart = new Date(now.getTime() - THIRTY_DAYS_IN_MS)
        const [[stationReportCountRow], recentReportsByStation] = await Promise.all([
            this.db.select({ value: count() }).from(reports).where(eq(reports.stationId, stationId)),
            this.db
                .select({ stationId: reports.stationId, value: count() })
                .from(reports)
                .where(gte(reports.timestamp, countRangeStart))
                .groupBy(reports.stationId),
        ])
        const stationReportCount = stationReportCountRow.value
        let lineReportCount: number | undefined
        if (stationReportCount < STATION_PROFILE_MINIMUM_REPORTS && station.lines.length === 1) {
            const [lineReportCountRow] = await this.db
                .select({ value: count() })
                .from(reports)
                .where(eq(reports.lineId, station.lines[0]))
            lineReportCount = lineReportCountRow.value
        }

        const scope = resolveProfileScope({
            stationId,
            stationLines: station.lines,
            stationReportCount,
            lineReportCount,
            citySlug: this.citySlug,
        })
        let profileReports: ProfileReport[]
        switch (scope.kind) {
            case 'station':
                profileReports = await this.db
                    .select({ timestamp: reports.timestamp })
                    .from(reports)
                    .where(eq(reports.stationId, stationId))
                break
            case 'line':
                profileReports = await this.db
                    .select({ timestamp: reports.timestamp })
                    .from(reports)
                    .where(eq(reports.lineId, scope.lineId))
                break
            case 'city':
                profileReports = await this.db.select({ timestamp: reports.timestamp }).from(reports)
                break
        }

        const profileCounts = new Map<string, number>()
        for (const report of profileReports) {
            const localTime = DateTime.fromJSDate(report.timestamp, { zone: this.timezone })
            const bucketKey = `${localTime.weekday}:${localTime.hour}`
            profileCounts.set(bucketKey, (profileCounts.get(bucketKey) ?? 0) + 1)
        }

        const reportCount = recentReportsByStation.find((row) => row.stationId === stationId)?.value ?? 0
        const population = Object.keys(stations).length
        const position = 1 + recentReportsByStation.filter((row) => row.value > reportCount).length

        const countRange = { start: toIso(countRangeStart), end: toIso(now) }
        return stationInsightsSchema.parse({
            stationId,
            generatedAt: toIso(now),
            timezone: this.timezone,
            scope,
            profile: {
                sourceRange: {
                    start: toIso(earliestTimestamp(profileReports, now)),
                    end: toIso(now),
                },
                bucket: { unit: 'hour', partition: 'dayOfWeek' },
                values: Array.from({ length: 7 }, (_, dayIndex) =>
                    Array.from({ length: 24 }, (_, hour) => ({
                        dayOfWeek: dayIndex + 1,
                        hour,
                        reportCount: profileCounts.get(`${dayIndex + 1}:${hour}`) ?? 0,
                    }))
                ).flat(),
            },
            reportCount: { value: reportCount, range: countRange },
            ranking: {
                position,
                population,
                metric: { name: 'reports', aggregation: 'count', range: countRange },
            },
        })
    }
}
