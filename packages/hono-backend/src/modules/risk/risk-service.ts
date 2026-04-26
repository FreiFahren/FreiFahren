import { join } from 'path'

import { DateTime } from 'luxon'

import { AppError } from '../../common/errors'
import type { ReportsService } from '../reports/reports-service'
import type { TransitNetworkDataService } from '../transit/transit-network-data-service'

type RiskData = {
    segments_risk: Record<string, { color: string; risk: number }>
}

const RISK_CACHE_TTL_MS = 5 * 60 * 1000

type RiskCacheEntry = {
    expiresAtMillis: number
    promise: Promise<RiskData>
}

export class RiskService {
    private riskCache: RiskCacheEntry | null = null

    constructor(
        private reportsService: ReportsService,
        private transitNetworkDataService: TransitNetworkDataService
    ) {}

    async getRisk(currentTime: DateTime = DateTime.utc()): Promise<RiskData> {
        const cachedEntry = this.riskCache
        if (cachedEntry !== null && cachedEntry.expiresAtMillis > currentTime.toMillis()) {
            return cachedEntry.promise
        }

        const promise = this.getRiskUncached(currentTime)
        const cacheEntry = {
            expiresAtMillis: currentTime.toMillis() + RISK_CACHE_TTL_MS,
            promise,
        }
        this.riskCache = cacheEntry

        try {
            return await promise
        } catch (error) {
            if (this.riskCache === cacheEntry) {
                this.riskCache = null
            }

            throw error
        }
    }

    clearCache(): void {
        this.riskCache = null
    }

    private async getRiskUncached(now: DateTime): Promise<RiskData> {
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
