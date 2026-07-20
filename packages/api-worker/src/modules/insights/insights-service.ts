import { asc, count, desc, eq, gte, inArray } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { AppError } from '../../common/errors'
import { DbConnection, lines, reports, stations } from '../../db'
import type { TransitNetworkDataService } from '../transit/transit-network-data-service'
import type { StationId } from '../transit/types'

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000
const MIN_PROFILE_REPORTS = 80
const MIN_PROFILE_WEEKS = 24

const rangeSchema = z.object({
    start: z.iso.datetime(),
    end: z.iso.datetime(),
})

export const stationInsightsSchema = z.object({
    reportCount: z.object({
        value: z.number().int().nonnegative(),
        range: rangeSchema,
    }),
    ranking: z.object({
        position: z.number().int().positive(),
        population: z.number().int().positive(),
    }),
})

export type StationInsights = z.infer<typeof stationInsightsSchema>

const profileHourSchema = z.object({
    hour: z.number().int().min(0).max(23),
    value: z.number().int().nonnegative(),
})

const metricSchema = z.object({
    name: z.literal('report_count'),
    range: rangeSchema,
})

export const lineInsightsSchema = z.object({
    line: z.object({
        name: z.string(),
        variantCount: z.number().int().positive(),
    }),
    profile: z.object({
        source: z.enum(['line_reports', 'city_reports']),
        metric: metricSchema,
        weekday: z.number().int().min(1).max(7),
        hours: z.array(profileHourSchema).length(24),
    }),
    hotspots: z.object({
        source: z.literal('reports'),
        metric: metricSchema,
        stations: z.array(
            z.object({
                stationId: z.string(),
                name: z.string(),
                value: z.number().int().nonnegative(),
                share: z.number().min(0).max(1),
            })
        ),
    }),
})

export type LineInsights = z.infer<typeof lineInsightsSchema>

const toIso = (date: Date) => date.toISOString()

export class InsightsService {
    constructor(
        private db: DbConnection,
        private transitNetworkDataService: TransitNetworkDataService,
        private timezone: string = 'UTC'
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
        const countRangeStart = new Date(now.getTime() - THIRTY_DAYS_IN_MS)
        const recentReportsByStation = await this.db
            .select({ stationId: reports.stationId, value: count() })
            .from(reports)
            .where(gte(reports.timestamp, countRangeStart))
            .groupBy(reports.stationId)

        const reportCount = recentReportsByStation.find((row) => row.stationId === stationId)?.value ?? 0
        const population = Object.keys(stations).length
        const position = 1 + recentReportsByStation.filter((row) => row.value > reportCount).length

        const countRange = { start: toIso(countRangeStart), end: toIso(now) }
        return stationInsightsSchema.parse({
            reportCount: { value: reportCount, range: countRange },
            ranking: {
                position,
                population,
            },
        })
    }

    async getLineInsights(lineName: string, now: Date = new Date()): Promise<LineInsights> {
        const matchingLines = await this.db.select({ id: lines.id }).from(lines).where(eq(lines.name, lineName))
        if (matchingLines.length === 0) {
            throw new AppError({
                message: 'Line not found',
                statusCode: 404,
                internalCode: 'LINE_NOT_FOUND',
                description: `lineName=${lineName}`,
            })
        }
        const variantIds = matchingLines.map((line) => line.id)

        // Historical insights read the reports table directly. Predictions belong only to the live
        // Reports service and must never enter this cacheable response.
        const historicalReports = await this.db
            .select({ timestamp: reports.timestamp, stationId: reports.stationId })
            .from(reports)
            .where(inArray(reports.lineId, variantIds))
            .orderBy(asc(reports.timestamp))

        const weekday = DateTime.fromJSDate(now, { zone: this.timezone }).weekday
        const lineProfileReports = historicalReports.filter(
            (report) => DateTime.fromJSDate(report.timestamp, { zone: this.timezone }).weekday === weekday
        )
        const profileWeeks = new Set(
            lineProfileReports.map((report) => {
                const time = DateTime.fromJSDate(report.timestamp, { zone: this.timezone })
                return `${time.weekYear}-${time.weekNumber}`
            })
        )
        const profileUsesCityFallback =
            lineProfileReports.length < MIN_PROFILE_REPORTS || profileWeeks.size < MIN_PROFILE_WEEKS
        const profileReports = profileUsesCityFallback
            ? await this.db.select({ timestamp: reports.timestamp }).from(reports).orderBy(asc(reports.timestamp))
            : lineProfileReports
        const profileRange = { start: toIso(profileReports[0]?.timestamp ?? now), end: toIso(now) }
        const observedRange = { start: toIso(historicalReports[0]?.timestamp ?? now), end: toIso(now) }
        const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, value: 0 }))
        const totalsByStation = new Map<string, number>()
        for (const report of profileReports) {
            const time = DateTime.fromJSDate(report.timestamp, { zone: this.timezone })
            if (time.weekday === weekday) hours[time.hour]!.value += 1
        }
        for (const report of historicalReports) {
            totalsByStation.set(report.stationId, (totalsByStation.get(report.stationId) ?? 0) + 1)
        }

        const hotspotRows = await this.db
            .select({ stationId: stations.id, name: stations.name, value: count() })
            .from(reports)
            .innerJoin(stations, eq(stations.id, reports.stationId))
            .where(inArray(reports.lineId, variantIds))
            .groupBy(stations.id, stations.name)
            .orderBy(desc(count()))

        const total = historicalReports.length
        return lineInsightsSchema.parse({
            line: { name: lineName, variantCount: variantIds.length },
            profile: {
                source: profileUsesCityFallback ? 'city_reports' : 'line_reports',
                metric: { name: 'report_count', range: profileRange },
                weekday,
                hours,
            },
            hotspots: {
                source: 'reports',
                metric: { name: 'report_count', range: observedRange },
                stations: hotspotRows.map((station) => ({
                    ...station,
                    share: total === 0 ? 0 : station.value / total,
                })),
            },
        })
    }
}
