import type { CityConfig } from '@freifahren/cities'

import type { TrustedReportGate } from './report-gate-contract'
import type { TransitIndex } from './types'
import { type ExtractionResult, extractionToLog, isEmpty } from './extractor'
import { resolveLineVariant } from './transit'

export interface ReportPayload {
    stationId: string
    source: 'telegram'
    lineId?: string
    directionId?: string
}

export interface ReportIdentifiers {
    stationId: string
    lineId: string | null
    directionId: string | null
}

export function buildReportPayload(ids: ReportIdentifiers): ReportPayload {
    const payload: ReportPayload = { stationId: ids.stationId, source: 'telegram' }
    if (ids.lineId !== null) {
        payload.lineId = ids.lineId
    }
    if (ids.directionId !== null) {
        payload.directionId = ids.directionId
    }
    return payload
}

export function reportIdentifiers(index: TransitIndex, extraction: ExtractionResult): ReportIdentifiers | null {
    if (isEmpty(extraction)) {
        console.info('LLM returned no inspector report for this message')
        return null
    }
    if (extraction.stationId === null) {
        // Backend requires at least one identifier and our pipeline keys off the station.
        console.info('Extraction lacked stationId; skipping', extractionToLog(extraction))
        return null
    }

    const lineId =
        extraction.lineName !== null ? resolveLineVariant(index, extraction.lineName, extraction.stationId) : null

    return { stationId: extraction.stationId, lineId, directionId: extraction.directionId }
}

// Throws on a rejected RPC result; the caller reports it (no retry).
export async function postReport(
    reportGate: TrustedReportGate,
    ids: ReportIdentifiers,
    city: CityConfig
): Promise<void> {
    const result = await reportGate.intake({
        city: {
            slug: city.slug,
            publicAppUrl: city.publicAppUrl,
            dbBinding: city.dbBinding,
            telegramChatId: city.community.telegramChatId ?? null,
            reporting: city.reporting,
        },
        report: buildReportPayload(ids),
    })
    if (!result.ok) {
        throw new Error(`Trusted report intake failed: ${result.error.internalCode}`)
    }
}
