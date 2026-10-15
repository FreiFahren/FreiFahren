import { CITY_DATABASES } from '@freifahren/cities'
import { and, inArray, isNotNull, lt, or } from 'drizzle-orm'

import type { Bindings } from '../../app-env'
import { createLogger } from '../../common/logger'
import { createD1Db, type DbConnection, reports } from '../../db'

// The privacy policy promises this period.
export const REPORT_METADATA_RETENTION_DAYS = 30

const RETENTION_MS = REPORT_METADATA_RETENTION_DAYS * 24 * 60 * 60 * 1000

// Bounded so the first run over the full history doesn't hit D1's per-query limits.
const BATCH_SIZE = 5_000

export const clearExpiredReportMetadata = async (db: DbConnection, now: number = Date.now()): Promise<number> => {
    const expired = and(
        lt(reports.timestamp, new Date(now - RETENTION_MS)),
        or(
            isNotNull(reports.clientHash),
            isNotNull(reports.asn),
            isNotNull(reports.asOrganization),
            isNotNull(reports.uaFamily),
            isNotNull(reports.trustFlags)
        )
    )

    let cleared = 0
    for (;;) {
        const batch = await db.select({ reportId: reports.reportId }).from(reports).where(expired).limit(BATCH_SIZE)
        if (batch.length === 0) return cleared

        await db
            .update(reports)
            .set({ clientHash: null, asn: null, asOrganization: null, uaFamily: null, trustFlags: null })
            .where(
                inArray(
                    reports.reportId,
                    batch.map((row) => row.reportId)
                )
            )
        cleared += batch.length
        if (batch.length < BATCH_SIZE) return cleared
    }
}

export const clearExpiredReportMetadataForAllCities = async (env: Bindings, now: number = Date.now()) => {
    const logger = createLogger(env.LOG_LEVEL ?? 'info')
    for (const [city, { dbBinding }] of Object.entries(CITY_DATABASES)) {
        const binding = (env as unknown as Record<string, D1Database | undefined>)[dbBinding]
        if (binding === undefined) {
            logger.error({ city, dbBinding }, 'City database binding missing; report metadata not cleared')
            continue
        }
        const cleared = await clearExpiredReportMetadata(createD1Db(binding), now)
        logger.info({ city, cleared }, 'Cleared expired report metadata')
    }
}
