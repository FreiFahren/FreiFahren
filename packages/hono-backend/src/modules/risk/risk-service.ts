import { join } from 'path'

import { DateTime } from 'luxon'

import { AppError } from '../../common/errors'
import type { ReportsService } from '../reports/reports-service'
import type { TransitNetworkDataService } from '../transit/transit-network-data-service'

type RiskData = {
    segments_risk: Record<string, { color: string; risk: number }>
}

export class RiskService {
    constructor(
        private reportsService: ReportsService,
        private transitNetworkDataService: TransitNetworkDataService
    ) {}

    async getRisk(): Promise<RiskData> {
        const now = DateTime.utc()
        const oneHourAgo = now.minus({ hours: 1 })

        const [segmentsCollection, realReports, stations] = await Promise.all([
            this.transitNetworkDataService.getSegments(),
            this.reportsService.getRealReports({ from: oneHourAgo, to: now }),
            this.transitNetworkDataService.getStations(),
        ])

        const pythonReports = realReports.flatMap((r) => {
            const lines = r.lineId !== null ? [r.lineId] : stations[r.stationId].lines
            if (lines.length === 0) return []
            return [
                {
                    station_id: r.stationId,
                    lines,
                    direction: r.directionId ?? '',
                    timestamp: r.timestamp.toISOString(),
                },
            ]
        })

        const scriptPath = join(import.meta.dir, 'risk_model.py')
        const uvBin = process.env.UV_BIN ?? 'uv'
        const proc = Bun.spawn([uvBin, 'run', scriptPath], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
        proc.stdin.write(JSON.stringify({ segments: segmentsCollection.features, reports: pythonReports }))
        await proc.stdin.end()

        const exitCode = await proc.exited
        if (exitCode !== 0) {
            throw new AppError({
                message: 'Risk model failed',
                statusCode: 500,
                internalCode: 'RISK_MODEL_FAILED',
                description: await new Response(proc.stderr).text(),
            })
        }

        return (await new Response(proc.stdout).json()) as RiskData
    }
}
