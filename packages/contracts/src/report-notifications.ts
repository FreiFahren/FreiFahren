import { z } from 'zod'

// The telegram-worker's TelegramNotificationsEntrypoint, told by report-gate about every report it
// accepts so the city's Telegram group hears about it.

export const acceptedReportNotificationSchema = z
    .object({
        city: z.string().min(1).max(64),
        report: z
            .object({
                reportId: z.number().int().positive(),
                stationId: z.string().min(1).max(16),
                lineId: z.string().min(1).max(16).nullable(),
                directionId: z.string().min(1).max(16).nullable(),
                timestamp: z.iso.datetime(),
                source: z.enum(['web_app', 'mini_app', 'mobile_app', 'telegram']),
            })
            .strict(),
    })
    .strict()

export type AcceptedReportNotification = z.infer<typeof acceptedReportNotificationSchema>

export type ReportNotifications = {
    reportAccepted(input: AcceptedReportNotification): Promise<void>
}
