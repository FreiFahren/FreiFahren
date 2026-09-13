import { WorkerEntrypoint } from 'cloudflare:workers'
import { AcceptedReportNotification } from './types'

import { deliveryEnabled, notificationCity } from './forwarding'

export class TelegramNotifications extends WorkerEntrypoint<Cloudflare.Env & { TELEGRAM_BOT_TOKEN?: string }> {
    async reportAccepted(input: AcceptedReportNotification): Promise<void> {
        const parsed = AcceptedReportNotification.safeParse(input)
        if (!parsed.success) throw new Error('Invalid accepted report notification')
        const { city, report } = parsed.data
        if (report.source === 'telegram' || !deliveryEnabled(notificationCity(city), this.env)) return
        if (!this.env.TELEGRAM_BOT_TOKEN) throw new Error('Telegram bot token is not configured')
        await this.env.CITY_DELIVERY.getByName(city).accept(parsed.data)
    }
}
