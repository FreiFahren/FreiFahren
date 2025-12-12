import { and, gte, lte } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { z } from 'zod'

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
    pipe,
    RawReport,
    clearDirectionIfStationAndDirectionAreTheSame,
    ifDirectionPresentWithoutLineClearDirection,
} from './post-process-report'

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

    async getReports({ from, to }: { from: DateTime; to: DateTime }) {
        const result = await this.db
            .select({
                timestamp: reports.timestamp,
                stationId: reports.stationId,
                directionId: reports.directionId,
                lineId: reports.lineId,
            })
            .from(reports)
            .where(and(gte(reports.timestamp, from.toJSDate()), lte(reports.timestamp, to.toJSDate())))

        return result
    }

    async createReport(reportData: InsertReport): Promise<{ telegramNotificationSuccess: boolean }> {
        await this.db.insert(reports).values(reportData)

        let telegramNotificationSuccess = true

        if (reportData.source !== 'telegram' && process.env.NODE_ENV === 'production') {
            try {
                await this.notifyTelegram(reportData)
            } catch {
                telegramNotificationSuccess = false
            }
        }

        return { telegramNotificationSuccess }
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

        const processed = pipe(
            reportData,
            clearStationReferenceIfNotOnLine(stations, 'stationId'),
            clearStationReferenceIfNotOnLine(stations, 'directionId'),
            assignLineIfSingleOption(stations),
            determineLineBasedOnStationAndDirection(stations),
            correctDirectionIfImplied(lines),
            clearDirectionIfStationAndDirectionAreTheSame,
            ifDirectionPresentWithoutLineClearDirection,
            guessStation
        )

        return processed as InsertReport // TODO: remove this cast
    }
}
