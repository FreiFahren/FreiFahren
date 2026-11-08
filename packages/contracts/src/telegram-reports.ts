import { z } from 'zod'

import type { CreatedReport, ReportGateResult } from './report-gate'

// The API's TrustedTelegramReportsEntrypoint, called by the telegram-worker with reports it parsed
// from a city's Telegram group.

export const telegramReportIntakeSchema = z
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

export type TelegramReportIntake = z.infer<typeof telegramReportIntakeSchema>

export type TelegramReports = {
    intake(request: TelegramReportIntake): Promise<ReportGateResult<CreatedReport>>
}
