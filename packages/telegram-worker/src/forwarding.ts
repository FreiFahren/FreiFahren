import type { Env, ForwardedReport, TransitIndex } from './types'
import { lineNameForId, stationLineNames } from './transit'
import { getTransitIndex } from './transit'
import { profileFor, readConfigForCity } from './config'
import { getCity, type CitySlug } from '@freifahren/cities'
import { reportError } from './observability'

/** HTML-escape for Telegram markup, quotes included. */
function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
}

class BadRequestError extends Error {}

export function validateForwardedReport(payload: unknown): ForwardedReport {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        throw new BadRequestError('JSON body must be an object')
    }
    const body = payload as Record<string, unknown>
    const { lineId, stationId, directionId } = body

    if (lineId !== null && lineId !== undefined && typeof lineId !== 'string') {
        throw new BadRequestError('lineId must be a string or null')
    }
    if (typeof stationId !== 'string' || stationId === '') {
        throw new BadRequestError('stationId must be a non-empty string')
    }
    if (directionId !== null && directionId !== undefined && typeof directionId !== 'string') {
        throw new BadRequestError('directionId must be a string or null')
    }

    const allowed = new Set(['lineId', 'stationId', 'directionId'])
    const keys = Object.keys(body)
    if (keys.length !== allowed.size || !keys.every((k) => allowed.has(k))) {
        throw new BadRequestError('body must contain exactly lineId, stationId, and directionId')
    }

    return {
        lineId: (lineId as string | null | undefined) ?? null,
        stationId,
        directionId: (directionId as string | null | undefined) ?? null,
    }
}

export function validateTransitReferences(index: TransitIndex, report: ForwardedReport): void {
    if (!(report.stationId in index.stations)) {
        throw new BadRequestError(`unknown stationId: ${report.stationId}`)
    }
    if (report.directionId !== null && !(report.directionId in index.stations)) {
        throw new BadRequestError(`unknown directionId: ${report.directionId}`)
    }

    const lineName = report.lineId !== null ? lineNameForId(index, report.lineId) : null
    if (report.lineId !== null && lineName === null) {
        throw new BadRequestError(`unknown lineId: ${report.lineId}`)
    }
    if (lineName !== null && !stationLineNames(index, report.stationId).includes(lineName)) {
        throw new BadRequestError(`stationId ${report.stationId} is not served by lineId ${report.lineId}`)
    }
    if (
        lineName !== null &&
        report.directionId !== null &&
        !stationLineNames(index, report.directionId).includes(lineName)
    ) {
        throw new BadRequestError(`directionId ${report.directionId} is not served by lineId ${report.lineId}`)
    }
}

export function formatForwardedReport(index: TransitIndex, report: ForwardedReport, publicAppUrl: string): string {
    const station = index.stations[report.stationId]
    const direction = report.directionId !== null ? index.stations[report.directionId] : null
    const lineName = report.lineId !== null ? lineNameForId(index, report.lineId) : null
    // utm_source lets the app attribute arrivals from this link in analytics (PostHog
    // captures utm_* automatically). The app redirects /station/<id> to the live report
    // view when one is fresh.
    const stationUrl = `${publicAppUrl}/station/${report.stationId}?utm_source=telegram&utm_medium=bot`

    const lines = [`<b>Station:</b> ${escapeHtml(station.name)}`]
    if (lineName !== null) {
        lines.push(`<b>Line:</b> ${escapeHtml(lineName)}`)
    }
    if (direction !== null) {
        lines.push(`<b>Direction:</b> ${escapeHtml(direction.name)}`)
    }
    lines.push('')
    lines.push(`Mehr Informationen auf <a href="${escapeHtml(stationUrl)}">${publicAppUrl}</a>`)
    return lines.join('\n')
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            // Telegram fetches the og:image server-side to build the card, so it's kept small.
            link_preview_options: {
                is_disabled: false,
                prefer_large_media: false,
                show_above_text: false,
            },
        }),
        // No retry: a timed-out send may already have posted to the group.
        signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) {
        throw new Error(`Telegram sendMessage failed: ${response.status} ${await response.text()}`)
    }
}

const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

export async function handleReportForward(request: Request, env: Env): Promise<Response> {
    const citySlug = new URL(request.url).searchParams.get('city')
    const city = citySlug === null ? null : getCity(citySlug)
    if (city === null || city === undefined) {
        return json({ error: 'bad_request', detail: 'unknown city' }, 400)
    }
    const cfg = readConfigForCity(env, city.slug as CitySlug)

    if (request.headers.get('X-Password') !== cfg.reportPassword) {
        console.warn('Report forward rejected: bad password')
        return json({ error: 'unauthorized' }, 401)
    }

    // Validate the body shape before fetching transit data so a malformed request
    // doesn't hit the backend.
    let report: ForwardedReport
    try {
        report = validateForwardedReport(await request.json())
    } catch (err) {
        const detail = err instanceof Error ? err.message : 'invalid request'
        return json({ error: 'bad_request', detail }, 400)
    }

    let index: TransitIndex
    try {
        index = await getTransitIndex(cfg.backendUrl, profileFor(cfg.city.slug), cfg.city.slug)
    } catch (err) {
        reportError('Failed to load transit data', err)
        return json({ error: 'transit_unavailable' }, 502)
    }

    try {
        validateTransitReferences(index, report)
    } catch (err) {
        const detail = err instanceof Error ? err.message : 'invalid request'
        return json({ error: 'bad_request', detail }, 400)
    }

    try {
        await sendTelegramMessage(
            cfg.telegramBotToken,
            cfg.telegramReportChatId,
            formatForwardedReport(index, report, cfg.publicAppUrl)
        )
    } catch (err) {
        reportError('Failed to forward app report to Telegram', err)
        return json({ error: 'telegram_send_failed' }, 502)
    }

    console.info('Forwarded app report to Telegram', { stationId: report.stationId })
    return json({ status: 'success' })
}
