import { getCity } from '@freifahren/cities'
import type { Env, TransitIndex } from './types'
import type { AcceptedReportNotification } from './types'
import { profileFor } from './config'
import { getTransitIndex, lineNameForId } from './transit'
import { reportError } from './observability'
import { sendTelegramMessage } from './telegram-client'

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
}

function formatForwardedReport(
    index: TransitIndex,
    report: AcceptedReportNotification['report'],
    publicAppUrl: string
): string {
    const station = index.stations[report.stationId]
    const direction = report.directionId !== null ? index.stations[report.directionId] : null
    const lineName = report.lineId !== null ? lineNameForId(index, report.lineId) : null
    // utm_source lets the app attribute arrivals from this link in analytics (PostHog
    // captures utm_* automatically). The app redirects /station/<id> to the live report
    // view when one is fresh.
    const stationUrl = `${publicAppUrl}/station/${encodeURIComponent(report.stationId)}?utm_source=telegram&utm_medium=bot`

    const lines = [`<b>Station:</b> ${escapeHtml(station.name)}`]
    if (lineName !== null) {
        lines.push(`<b>Line:</b> ${escapeHtml(lineName)}`)
    }
    if (direction !== null) {
        lines.push(`<b>Direction:</b> ${escapeHtml(direction.name)}`)
    }
    lines.push('')
    lines.push(`Mehr Informationen auf <a href="${escapeHtml(stationUrl)}">${escapeHtml(publicAppUrl)}</a>`)
    return lines.join('\n')
}

export async function forwardReport(
    { city: slug, report }: AcceptedReportNotification,
    env: Pick<Env, 'NODE_ENV' | 'BACKEND_URL' | 'TELEGRAM_BOT_TOKEN'>,
    ctx: ExecutionContext
): Promise<void> {
    const city = getCity(slug)
    if (!city) throw new Error('Unknown notification city')
    if (
        env.NODE_ENV !== 'production' ||
        report.source === 'telegram' ||
        !city.reporting.telegramForwardingEnabled ||
        !city.community.telegramChatId
    )
        return

    try {
        if (!env.TELEGRAM_BOT_TOKEN) throw new Error('Telegram bot token is not configured')
        const index = await getTransitIndex(env.BACKEND_URL, profileFor(slug), slug, ctx)
        if (
            !index.stations[report.stationId] ||
            (report.directionId !== null && !index.stations[report.directionId]) ||
            (report.lineId !== null && lineNameForId(index, report.lineId) === null)
        ) {
            throw new Error('Notification references unknown transit data')
        }
        await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            city.community.telegramChatId,
            formatForwardedReport(index, report, city.publicAppUrl)
        )
    } catch (error) {
        reportError('Failed to forward app report to Telegram', error, { city: slug, reportId: report.reportId })
        throw error
    }
}
