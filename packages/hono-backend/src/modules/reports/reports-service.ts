import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { AppError } from '../../common/errors'
import { lookupStation } from '../../common/utils'
import { DbConnection, InsertReport, reports } from '../../db/'
import type { TransitNetworkDataService } from '../transit/transit-network-data-service'
import type { StationId } from '../transit/types'

import {
    assignLineIfSingleOption,
    clearStationReferenceIfNotOnLine,
    correctDirectionIfImplied,
    determineLineBasedOnStationAndDirection,
    guessStation,
    pipeAsync,
    RawReport,
    clearDirectionIfStationAndDirectionAreTheSame,
    ifDirectionPresentWithoutLineClearDirection,
} from './post-process-report'

const MIN_PREDICTED_REPORTS_THRESHOLD = 1
const MAX_PREDICTED_REPORTS_THRESHOLD = 7

type LuxonWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

const isWeekend = (weekday: LuxonWeekday): boolean => weekday === 6 || weekday === 7

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const calculateBasePredictedReportsThreshold = (currentTime: DateTime): number => {
    const minutesPastMidnight = currentTime.hour * 60 + currentTime.minute

    const isSaturday = currentTime.weekday === 6

    if (minutesPastMidnight >= 18 * 60 && isSaturday && minutesPastMidnight < 24 * 60) {
        // On Saturdays, decrease linearly from 18:00 to 24:00
        return 7 - (minutesPastMidnight - 18 * 60) * (9.0 / (6 * 60))
    }

    if (minutesPastMidnight >= 18 * 60 && minutesPastMidnight < 21 * 60) {
        // On other days, decrease linearly from 18:00 to 21:00
        return 7 - (minutesPastMidnight - 18 * 60) * (9.0 / (3 * 60))
    }

    if (minutesPastMidnight >= 21 * 60 || minutesPastMidnight < 7 * 60) {
        // Stay at 1 between 21:00 to 7:00
        return 1
    }

    if (minutesPastMidnight >= 7 * 60 && minutesPastMidnight < 9 * 60) {
        // Increase linearly from 7:00 to 9:00
        return 1 + (minutesPastMidnight - 7 * 60) * (9.0 / (2 * 60))
    }

    return 7
}

/**
 * Applies the legacy weekend reduction. The reduction is computed from the *truncated* base value,
 * which is important for matching the previous behavior.
 */
const calculateWeekendAdjustment = (currentTime: DateTime, baseThreshold: number): number => {
    if (!isWeekend(currentTime.weekday as LuxonWeekday)) return 0

    const truncatedBase = Math.trunc(baseThreshold)
    return truncatedBase * 0.5
}

type TelegramNotificationPayload = {
    line: string | null
    station: string
    direction: StationId | null
    message: string | null
    stationId: StationId
}

export class ReportsService {
    constructor(
        private db: DbConnection,
        private transitNetworkDataService: TransitNetworkDataService
    ) {}

    async getReports({ from, to, currentTime }: { from: DateTime; to: DateTime; currentTime: DateTime }) {
        const result = await this.db
            .select({
                timestamp: reports.timestamp,
                stationId: reports.stationId,
                directionId: reports.directionId,
                lineId: reports.lineId,
            })
            .from(reports)
            .where(and(gte(reports.timestamp, from.toJSDate()), lte(reports.timestamp, to.toJSDate())))

        const predictedReportsThreshold = this.calculatePredictedReportsThreshold(currentTime)
        console.log('predictedReportsThreshold', predictedReportsThreshold)

        return result
    }

    /*
    Returns the integer threshold that controls how many predicted/historic reports we should show.
    */
    // TODO: Write integration tests for this
    private calculatePredictedReportsThreshold(currentTime: DateTime): number {
        const base = calculateBasePredictedReportsThreshold(currentTime)
        const adjustment = calculateWeekendAdjustment(currentTime, base)
        const threshold = base - adjustment

        return Math.trunc(clamp(threshold, MIN_PREDICTED_REPORTS_THRESHOLD, MAX_PREDICTED_REPORTS_THRESHOLD))
    }

    async createReport(reportData: InsertReport): Promise<{
        telegramNotificationSuccess: boolean
        report: {
            reportId: number
            stationId: string
            lineId: string | null
            directionId: string | null
            timestamp: Date
        }
    }> {
        const [insertedReport] = await this.db.insert(reports).values(reportData).returning({
            reportId: reports.reportId,
            stationId: reports.stationId,
            lineId: reports.lineId,
            directionId: reports.directionId,
            timestamp: reports.timestamp,
        })
        // Drizzle returns the inserted row for Postgres. If this ever becomes undefined, we want to surface it fast.
        const report = insertedReport!

        let telegramNotificationSuccess = true

        if (reportData.source !== 'telegram' && process.env.NODE_ENV === 'production') {
            try {
                await this.notifyTelegram(reportData)
            } catch {
                telegramNotificationSuccess = false
            }
        }

        return { telegramNotificationSuccess, report }
    }

    private async notifyTelegram(reportData: InsertReport) {
        const nlpServiceUrl = z.string().min(1).parse(process.env.NLP_SERVICE_URL)
        const reportPassword = z.string().min(1).parse(process.env.REPORT_PASSWORD)

        const endpoint = `${nlpServiceUrl.replace(/\/$/, '')}/report-inspector`
        const payload = await this.buildTelegramNotificationPayload(reportData)

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Password': reportPassword,
            },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const errorDetail = await response.text().catch(() => 'No response body')
            throw new Error(`Telegram bot notification failed with status ${response.status}: ${errorDetail}`)
        }
    }

    // This is so stupid... we should really rewrite the Bot so that the endpoint is more sensible
    private async buildTelegramNotificationPayload(reportData: InsertReport): Promise<TelegramNotificationPayload> {
        const stations = await this.transitNetworkDataService.getStations()

        const station = lookupStation(stations, reportData.stationId)
        const direction = lookupStation(stations, reportData.directionId)

        return {
            line: reportData.lineId ?? null,
            station: station?.name ?? reportData.stationId,
            direction: direction?.name ?? reportData.directionId ?? null,
            message: null,
            stationId: reportData.stationId,
        }
    }

    async postProcessReport(reportData: RawReport): Promise<InsertReport> {
        const stations = await this.transitNetworkDataService.getStations()
        const lines = await this.transitNetworkDataService.getLines()

        const now = DateTime.utc()

        const processed = await pipeAsync(
            reportData,
            clearStationReferenceIfNotOnLine(stations, 'stationId'),
            clearStationReferenceIfNotOnLine(stations, 'directionId'),
            assignLineIfSingleOption(stations),
            determineLineBasedOnStationAndDirection(stations),
            correctDirectionIfImplied(lines),
            clearDirectionIfStationAndDirectionAreTheSame,
            ifDirectionPresentWithoutLineClearDirection,
            async (currentReport) => {
                if (
                    currentReport.stationId !== undefined ||
                    currentReport.lineId === null ||
                    currentReport.lineId === undefined
                ) {
                    return currentReport
                }

                const candidateRows = await this.db
                    .select({ stationId: reports.stationId, timestamp: reports.timestamp })
                    .from(reports)
                    .where(eq(reports.lineId, currentReport.lineId))
                    .orderBy(desc(reports.timestamp))
                    .limit(1000)

                return guessStation(candidateRows)(now.hour, now.weekday)(currentReport)
            },
            clearStationReferenceIfNotOnLine(stations, 'stationId'),
            clearStationReferenceIfNotOnLine(stations, 'directionId')
        )

        if (processed.stationId === undefined) {
            throw new AppError({
                message: 'Could not infer station from the provided information',
                statusCode: 422,
                internalCode: 'VALIDATION_FAILED',
                description: `Input data: ${JSON.stringify(reportData)} Current report: ${JSON.stringify(processed)}`,
            })
        }

        return { ...processed, stationId: processed.stationId }
    }
}
