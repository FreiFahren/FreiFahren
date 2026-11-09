import { CITIES } from '@freifahren/cities'
import { createLogger } from '@freifahren/worker-kit/logger'

import { type Bindings, reportError } from '../../app-env'
import { createD1Db } from '../../db'
import { TransitNetworkDataService } from '../transit/transit-network-data-service'

import { StatisticsService } from './statistics-service'

export const refreshReportStatisticsForAllCities = async (env: Bindings, now: Date = new Date()) => {
    const logger = createLogger(env.LOG_LEVEL ?? 'info')
    for (const city of Object.values(CITIES)) {
        const binding = (env as unknown as Record<string, D1Database | undefined>)[city.dbBinding]
        if (binding === undefined) {
            logger.error(
                { city: city.slug, dbBinding: city.dbBinding },
                'City database binding missing; statistics not refreshed'
            )
            continue
        }
        try {
            const db = createD1Db(binding)
            const service = new StatisticsService(db, new TransitNetworkDataService(db, city.slug), city.timezone)
            const refreshed = await service.refreshDueSnapshots(now)
            logger.info({ city: city.slug, refreshed }, 'Refreshed report statistics')
        } catch (error) {
            // Reported per city so one failing database doesn't leave the others stale.
            logger.error(
                { city: city.slug, error: error instanceof Error ? error.message : String(error) },
                'Refreshing report statistics failed'
            )
            reportError(error, { tags: { task: 'report-statistics', city: city.slug } })
        }
    }
}
