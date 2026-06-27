import { DateTime } from 'luxon'

import { AppError } from '../../common/errors'
import type { ReportsService } from '../reports/reports-service'
import type { TransitNetworkDataService } from '../transit/transit-network-data-service'

import { predictSegmentRisk, type RiskModelReport, type RiskModelSegment } from './risk-model'

type RiskData = {
    segments_risk: Record<string, { color: string; risk: number }>
}

export class RiskService {
    constructor(
        private reportsService: ReportsService,
        private transitNetworkDataService: TransitNetworkDataService
    ) {}

    /*
     * The model runs in-process in a few milliseconds, so each request recomputes
     * from the latest reports instead of being served from a cache. This keeps the
     * output always fresh and removes the need to invalidate on new reports.
     */
    async getRisk(now: DateTime = DateTime.utc()): Promise<RiskData> {
        const oneHourAgo = now.minus({ hours: 1 })

        const [segmentsCollection, realReports, stations] = await Promise.all([
            this.transitNetworkDataService.getSegments(),
            this.reportsService.getRealReports({ from: oneHourAgo, to: now }),
            this.transitNetworkDataService.getStations(),
        ])

        const segments: RiskModelSegment[] = segmentsCollection.features.map((feature) => ({
            sid: String(feature.properties.id),
            lineId: feature.properties.line,
            fromStationId: feature.properties.from,
            toStationId: feature.properties.to,
        }))

        const reports: RiskModelReport[] = realReports.flatMap((r) => {
            const lines = r.lineId !== null ? [r.lineId] : stations[r.stationId].lines
            if (lines.length === 0) return []
            return [
                {
                    stationId: r.stationId,
                    lines,
                    directionId: r.directionId,
                    timestamp: r.timestamp,
                },
            ]
        })

        try {
            return { segments_risk: predictSegmentRisk(segments, reports, now.toJSDate()) }
        } catch (error) {
            throw new AppError({
                message: 'Risk model failed',
                statusCode: 500,
                internalCode: 'RISK_MODEL_FAILED',
                description: error instanceof Error ? error.message : String(error),
            })
        }
    }
}
