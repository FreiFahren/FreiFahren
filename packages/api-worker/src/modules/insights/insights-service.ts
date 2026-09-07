import { asc, count, gte, inArray, sql } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { AppError } from '../../common/errors'
import { DbConnection, reports } from '../../db'
import type { TransitNetworkDataService } from '../transit/transit-network-data-service'
import { cachedReference, type CacheCtx } from '../transit/reference-cache'
import type { StationId, Stations } from '../transit/types'

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

type CityProfile = { start: string | null; hours: Array<{ hour: number; value: number }> }

const toIso = (date: Date) => date.toISOString()

export class InsightsService {
    constructor(
        private db: DbConnection,
        private transitNetworkDataService: TransitNetworkDataService,
        private timezone: string,
        private citySlug: string,
        private cacheCtx: CacheCtx = undefined
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
        const [insights] = await this.getLinesInsights([lineName], now)
        return insights!
    }

    async getLinesInsights(lineNames: string[], now: Date = new Date()): Promise<LineInsights[]> {
        const allLines = await this.transitNetworkDataService.getLines()
        const names = [...new Set(lineNames)]
        const variantsByName = new Map(names.map((name) => [name, allLines.filter((line) => line.name === name)]))
        for (const [name, variants] of variantsByName) {
            if (variants.length === 0) {
                throw new AppError({
                    message: 'Line not found',
                    statusCode: 404,
                    internalCode: 'LINE_NOT_FOUND',
                    description: `lineName=${name}`,
                })
            }
        }
        const selectedLines = [...variantsByName.values()].flat()
        // Read history once for the entire preload; live predictions never enter these insights.
        const [historicalReports, stationNames] = await Promise.all([
            this.db
                .select({ lineId: reports.lineId, timestamp: reports.timestamp, stationId: reports.stationId })
                .from(reports)
                .where(
                    inArray(
                        reports.lineId,
                        selectedLines.map((line) => line.id)
                    )
                )
                .orderBy(asc(reports.timestamp)),
            this.transitNetworkDataService.getStations(),
        ])
        const nameById = new Map(selectedLines.map((line) => [line.id, line.name]))
        const historyByName = new Map(names.map((name) => [name, [] as typeof historicalReports]))
        for (const report of historicalReports) {
            const name = report.lineId === null ? undefined : nameById.get(report.lineId)
            if (name !== undefined) historyByName.get(name)!.push(report)
        }
        let cityProfile: Promise<CityProfile> | undefined
        return Promise.all(
            names.map((name) =>
                this.buildLineInsights(
                    name,
                    variantsByName.get(name)!.length,
                    historyByName.get(name)!,
                    stationNames,
                    now,
                    () => (cityProfile ??= this.getCityProfile(now))
                )
            )
        )
    }

    private async getCityProfile(now: Date): Promise<CityProfile> {
        const localNow = DateTime.fromJSDate(now, { zone: this.timezone })
        const ttl = Math.max(1, Math.ceil(localNow.plus({ days: 1 }).startOf('day').diff(localNow, 'seconds').seconds))
        return cachedReference(
            this.citySlug,
            `city-profile-v1/${this.timezone}/${localNow.toISODate()}`,
            async () => {
                // UTC quarter-hours preserve local hour/weekday boundaries, including DST and fractional offsets.
                const bucket = sql<number>`cast(${reports.timestamp} / 900000 as integer)`
                const rows = await this.db
                    .select({
                        bucket,
                        first: sql<number>`min(${reports.timestamp})`,
                        value: count(),
                    })
                    .from(reports)
                    .groupBy(bucket)
                const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, value: 0 }))
                let first: number | undefined
                for (const row of rows) {
                    first = first === undefined ? row.first : Math.min(first, row.first)
                    const time = DateTime.fromMillis(row.bucket * 900000, { zone: this.timezone })
                    if (time.weekday === localNow.weekday) hours[time.hour]!.value += row.value
                }
                return { start: first === undefined ? null : new Date(first).toISOString(), hours }
            },
            this.cacheCtx,
            `public, max-age=${ttl}`
        )
    }

    private async buildLineInsights(
        lineName: string,
        variantCount: number,
        historicalReports: Array<{ timestamp: Date; stationId: string }>,
        stationNames: Stations,
        now: Date,
        loadCityProfile: () => Promise<CityProfile>
    ): Promise<LineInsights> {
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
        const cityProfile = profileUsesCityFallback ? await loadCityProfile() : undefined
        const profileRange = {
            start: cityProfile ? (cityProfile.start ?? toIso(now)) : toIso(lineProfileReports[0]?.timestamp ?? now),
            end: toIso(now),
        }
        const observedRange = { start: toIso(historicalReports[0]?.timestamp ?? now), end: toIso(now) }
        const hours = cityProfile?.hours ?? Array.from({ length: 24 }, (_, hour) => ({ hour, value: 0 }))
        const totalsByStation = new Map<string, number>()
        if (!cityProfile) {
            for (const report of lineProfileReports) {
                const time = DateTime.fromJSDate(report.timestamp, { zone: this.timezone })
                hours[time.hour]!.value += 1
            }
        }
        for (const report of historicalReports) {
            totalsByStation.set(report.stationId, (totalsByStation.get(report.stationId) ?? 0) + 1)
        }

        const hotspotRows = [...totalsByStation]
            .filter(([stationId]) => Object.hasOwn(stationNames, stationId))
            .map(([stationId, value]) => ({ stationId, name: stationNames[stationId]!.name, value }))
            .sort((a, b) => {
                if (a.value !== b.value) return b.value - a.value
                if (a.stationId === b.stationId) return 0
                return a.stationId < b.stationId ? -1 : 1
            })

        const total = historicalReports.length
        return lineInsightsSchema.parse({
            line: { name: lineName, variantCount },
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
