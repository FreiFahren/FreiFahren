import { getCity } from '@freifahren/cities'
import type { Env, TransitIndex } from './types'
import type { AcceptedReportNotification } from './types'
import { profileFor } from './config'
import { getTransitIndex, lineNameForId } from './transit'
import { DELIVERY_POLICY } from './delivery-policy'

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

export function notificationCity(slug: string) {
    const city = getCity(slug)
    if (!city) throw new Error('Unknown notification city')
    return city
}

export function deliveryEnabled(city: ReturnType<typeof notificationCity>, env: Pick<Env, 'NODE_ENV'>): boolean {
    return env.NODE_ENV === 'production' && city.reporting.telegramForwardingEnabled && !!city.community.telegramChatId
}

export async function renderDelivery(
    slug: string,
    reports: AcceptedReportNotification['report'][],
    mode: 'individual' | 'digest',
    env: Pick<Env, 'BACKEND_URL' | 'TRANSIT_API'>,
    ctx: Pick<ExecutionContext, 'waitUntil'>
): Promise<string> {
    const city = notificationCity(slug)
    const index = await getTransitIndex(env.BACKEND_URL, profileFor(slug), slug, env.TRANSIT_API, ctx)
    for (const report of reports) {
        if (
            !index.stations[report.stationId] ||
            (report.directionId !== null && !index.stations[report.directionId]) ||
            (report.lineId !== null && lineNameForId(index, report.lineId) === null)
        ) {
            throw new Error('Notification references unknown transit data')
        }
    }
    if (mode === 'individual') return formatForwardedReport(index, reports[0], city.publicAppUrl)
    const time = (timestamp: string) =>
        new Intl.DateTimeFormat(city.lang, {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: city.timezone,
        }).format(new Date(timestamp))
    const stations = new Map<string, { count: number; latest: string; lines: Set<string> }>()
    for (const report of reports) {
        const station = stations.get(report.stationId) ?? {
            count: 0,
            latest: report.timestamp,
            lines: new Set<string>(),
        }
        station.count++
        if (report.timestamp > station.latest) station.latest = report.timestamp
        const line = report.lineId === null ? null : lineNameForId(index, report.lineId)
        if (line) station.lines.add(line)
        stations.set(report.stationId, station)
    }
    const timestamps = reports.map((report) => report.timestamp).sort()
    const lines = [
        `<b>${escapeHtml(city.displayName)} · App-Meldungen ${time(timestamps[0])}–${time(timestamps[timestamps.length - 1])}</b>`,
        `${reports.length} ${reports.length === 1 ? 'neue Meldung' : 'neue Meldungen'} an ${stations.size} ${stations.size === 1 ? 'Station' : 'Stationen'}`,
        '',
    ]
    const ranked = [...stations].sort(
        (a, b) => b[1].count - a[1].count || b[1].latest.localeCompare(a[1].latest) || a[0].localeCompare(b[0])
    )
    for (const [id, station] of ranked.slice(0, DELIVERY_POLICY.maxDigestStations)) {
        const lineNames = [...station.lines].sort().slice(0, 3).map(escapeHtml).join(', ')
        const item = `<b>${escapeHtml(index.stations[id].name)}</b> · ${station.count} ${station.count === 1 ? 'Meldung' : 'Meldungen'} · zuletzt ${time(station.latest)}${lineNames ? ` · ${lineNames}` : ''}`
        if (lines.join('\n').length + item.length > 3000) break
        lines.push(item)
    }
    lines.push(
        '',
        `<a href="${escapeHtml(city.publicAppUrl)}?utm_source=telegram&amp;utm_medium=bot">Alle Meldungen auf der Karte</a>`
    )
    return lines.join('\n')
}
