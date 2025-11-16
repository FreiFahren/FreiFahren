import { env } from 'bun'
import { and, gte, lte } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { DbConnection, InsertReport, reports } from '../../db/'
import type { HttpErrorBody } from '../../http-error'
import type { Stations, TransitNetworkDataService, StationId } from '../transit/transit-network-data-service'

type TelegramNotificationPayload = {
    line: string | null
    station: string
    direction: StationId | null
    message: string | null
    stationId: StationId
}

export class ReportsService {
    private readonly telegramNotificationEndpoint: string
    private readonly telegramNotificationPassword: string

    constructor(
        private db: DbConnection,
        private transitNetworkDataService: TransitNetworkDataService
    ) {
        const nlpServiceUrl = z.string().min(1).parse(env.NLP_SERVICE_URL)
        const reportPassword = z.string().min(1).parse(env.REPORT_PASSWORD)

        this.telegramNotificationEndpoint = `${nlpServiceUrl.replace(/\/$/, '')}/report-inspector`
        this.telegramNotificationPassword = reportPassword
    }

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

    async createReport(reportData: InsertReport): Promise<HttpErrorBody | null> {
        await this.db.insert(reports).values(reportData)

        if (reportData.source !== 'telegram') {
            try {
                await this.notifyTelegram(reportData)
            } catch (error) {
                const reason = error instanceof Error ? error.message : 'Unknown error'
                const description = `Failed to notify Telegram bot about inspector report: ${reason}`
                const body: HttpErrorBody = {
                    message: 'Notifying the telegram bot went wrong',
                    details: {
                        internal_code: 'TELEGRAM_NOTIFICATION_FAILED',
                        description,
                    },
                }

                return body
            }
        }

        return null
    }

    private async notifyTelegram(reportData: InsertReport) {
        const payload = await this.buildTelegramNotificationPayload(reportData)

        const response = await fetch(this.telegramNotificationEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Password': this.telegramNotificationPassword,
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

        const station = this.lookupStation(stations, reportData.stationId)
        const direction = this.lookupStation(stations, reportData.directionId)

        return {
            line: reportData.lineId ?? null,
            station: station?.name ?? reportData.stationId,
            direction: direction?.name ?? reportData.directionId ?? null,
            message: null,
            stationId: reportData.stationId,
        }
    }

    private lookupStation(stations: Stations, stationId?: StationId | null) {
        if (stationId === undefined || stationId === null) {
            return undefined
        }

        if (!Object.prototype.hasOwnProperty.call(stations, stationId)) {
            return undefined
        }

        return stations[stationId]
    }
}
