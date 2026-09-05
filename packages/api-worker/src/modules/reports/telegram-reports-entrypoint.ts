import { WorkerEntrypoint } from 'cloudflare:workers'
import { z } from 'zod'

import { type Bindings, createCityDatabase, createCityServices, reportError, resolveCityBySlug } from '../../app-env'
import { AppError } from '../../common/errors'
import { createLogger } from '../../common/logger'
import type { CreatedReport, ReportGateResult } from '../report-gate/report-gate-contract'

import { ReportSubmissionService } from './report-submission-service'
import { invalidateStationReportsCache } from './reports-cache-middleware'

const telegramReportSchema = z
    .object({
        city: z.string().min(1),
        report: z
            .object({
                stationId: z.string().min(1),
                lineId: z.string().nullable(),
                directionId: z.string().nullable(),
            })
            .strict(),
    })
    .strict()

export type TelegramReportIntake = z.infer<typeof telegramReportSchema>

export class TelegramReportsEntrypoint extends WorkerEntrypoint<Bindings> {
    async intake(input: TelegramReportIntake): Promise<ReportGateResult<CreatedReport>> {
        const logger = createLogger(this.env.LOG_LEVEL ?? 'info')
        try {
            const parsed = telegramReportSchema.safeParse(input)
            if (!parsed.success) {
                throw new AppError({
                    message: 'Invalid Telegram report',
                    statusCode: 400,
                    internalCode: 'VALIDATION_FAILED',
                })
            }
            const city = resolveCityBySlug(parsed.data.city)
            const db = createCityDatabase(this.env, city)
            const { reportsService } = createCityServices(db, city, this.ctx)
            const service = new ReportSubmissionService({
                city,
                reportsService,
                logger,
                // RPC has no browser origin. Other origins/colos retain the existing bounded TTL.
                invalidate: (stationId) =>
                    invalidateStationReportsCache(
                        'https://api.freifahren.org/v0/reports',
                        city.publicAppUrl,
                        city.slug,
                        stationId
                    ),
            })
            const data = await service.submitTelegramReport(parsed.data.report, this.env.TRUSTED_REPORT_GATE)
            return { ok: true, data }
        } catch (error) {
            const failure = error instanceof AppError ? error : new AppError({ message: 'Report submission failed' })
            logger.error(
                { internalCode: failure.internalCode, statusCode: failure.statusCode },
                'Telegram report submission failed'
            )
            if (!(error instanceof AppError) || failure.statusCode >= 500) {
                reportError(error, { tags: { task: 'telegram-report-intake' } })
            }
            return {
                ok: false,
                error: {
                    message: failure.message,
                    statusCode: failure.statusCode,
                    internalCode: failure.internalCode,
                },
            }
        }
    }
}
