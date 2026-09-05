import type { CityConfig } from '@freifahren/cities'

import { reportError } from '../../app-env'
import type { Logger } from '../../common/logger'
import { submitTrustedReportToGate } from '../report-gate/report-gate-client'
import type { CreatedReport, NormalizedReport, TrustedReportGate } from '../report-gate/report-gate-contract'

import type { RawReport } from './post-process-report'
import type { ReportsService } from './reports-service'

type SubmissionDependencies = {
    city: CityConfig
    reportsService: ReportsService
    logger: Logger
    invalidate: (stationId: string) => Promise<void>
}

export class ReportSubmissionService {
    constructor(private readonly dependencies: SubmissionDependencies) {}

    submitPublicReport(
        input: Omit<RawReport, 'source'> & { source: Exclude<RawReport['source'], 'telegram'> },
        submit: (report: NormalizedReport) => Promise<CreatedReport>
    ) {
        return this.submit(input, submit)
    }

    submitTelegramReport(input: Omit<RawReport, 'source'>, gate: TrustedReportGate | undefined) {
        const city = this.dependencies.city
        return this.submit({ ...input, source: 'telegram' }, (report) =>
            submitTrustedReportToGate(gate, {
                city: {
                    slug: city.slug,
                    publicAppUrl: city.publicAppUrl,
                    dbBinding: city.dbBinding,
                    telegramChatId: city.community.telegramChatId ?? null,
                    reporting: city.reporting,
                },
                report: { ...report, source: 'telegram' },
            })
        )
    }

    private async submit(input: RawReport, persist: (report: NormalizedReport) => Promise<CreatedReport>) {
        const { reportsService, logger, invalidate } = this.dependencies
        const normalized = await reportsService.postProcessReport(input)
        const created = await persist({
            ...normalized,
            lineId: normalized.lineId ?? null,
            directionId: normalized.directionId ?? null,
        })
        // A cache failure must not turn a committed report into a retryable submission failure.
        try {
            await invalidate(created.stationId)
        } catch (error) {
            logger.warn({ stationId: created.stationId }, 'Failed to invalidate station reports cache')
            reportError(error, { tags: { task: 'reports-cache-invalidation' } })
        }
        return created
    }
}
