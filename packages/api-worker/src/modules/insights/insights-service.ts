import { count, gte } from 'drizzle-orm'
import { z } from 'zod'

import { AppError } from '../../common/errors'
import { DbConnection, reports } from '../../db'
import type { TransitNetworkDataService } from '../transit/transit-network-data-service'
import type { StationId } from '../transit/types'

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000

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

const toIso = (date: Date) => date.toISOString()

export class InsightsService {
    constructor(
        private db: DbConnection,
        private transitNetworkDataService: TransitNetworkDataService
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
}
