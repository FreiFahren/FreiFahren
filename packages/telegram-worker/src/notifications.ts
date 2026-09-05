import { WorkerEntrypoint } from 'cloudflare:workers'
import { AcceptedReportNotification } from './types'

import { forwardReport } from './forwarding'

export class TelegramNotifications extends WorkerEntrypoint<Cloudflare.Env & { TELEGRAM_BOT_TOKEN?: string }> {
    async reportAccepted(input: AcceptedReportNotification): Promise<void> {
        const parsed = AcceptedReportNotification.safeParse(input)
        if (!parsed.success) throw new Error('Invalid accepted report notification')
        await forwardReport(parsed.data, this.env, this.ctx)
    }
}
