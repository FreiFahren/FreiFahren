import { and, gte, lte } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { AppError } from '../../common/errors'
import { DbConnection, InsertReport, reports } from '../../db/'
import type { TransitNetworkDataService } from '../transit/transit-network-data-service'
import type { Stations, StationId } from '../transit/types'

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

    /*
    This function verifies that the request is a legitimate report
    by checking the security service.
    */
    async verifyRequest(headers: Record<string, string>): Promise<void> {
        const reportPassword = process.env.REPORT_PASSWORD
        const isDev = process.env.NODE_ENV === 'development'

        // Exceptions for dev mode and the Telegram Bot (Identified by the X-Password header)
        if (
            (reportPassword !== undefined && reportPassword !== '' && headers['x-password'] === reportPassword) ||
            isDev
        ) {
            return
        }

        const securityServiceUrl = process.env.SECURITY_MICROSERVICE_URL
        console.log('securityServiceUrl', securityServiceUrl)
        if (securityServiceUrl === undefined || securityServiceUrl === '') {
            throw new Error('security service configuration error')
        }

        const response = await fetch(`${securityServiceUrl.replace(/\/$/, '')}/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ headers }),
        })

        if (!response.ok) {
            throw new Error(`failed to verify request with status ${response.status}: ${await response.text()}`)
        }

        const result = (await response.json()) as { valid: boolean }

        if (!result.valid) {
            throw new AppError({
                message:
                    'Spam reports are not allowed, if you have an issue with us contact us and we can hash it out.',
                statusCode: 403,
                internalCode: 'SPAM_REPORT_DETECTED',
            })
        }
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
