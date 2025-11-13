import { and, gte, lte } from 'drizzle-orm'
import { DateTime } from 'luxon'

import { DbConnection, InsertReport, reports } from '../../db/'
import { TransitNetworkDataService } from '../transit/transit-network-data-service'

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

    async createReport(reportData: InsertReport) {
        return this.db.insert(reports).values(reportData)
    }
}
