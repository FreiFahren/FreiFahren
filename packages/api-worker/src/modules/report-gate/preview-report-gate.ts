import type { Context } from 'hono'

import type { Env } from '../../app-env'
import { reports } from '../../db'

import type { NormalizedReport } from './report-gate-client'

export const isOpenReportPreview = (c: Context<Env>) => c.env.REPORT_GATE_MODE === 'preview-open'

export const submitOpenPreviewReport = async (c: Context<Env>, report: NormalizedReport) => {
    const createdRows = await c
        .get('db')
        .insert(reports)
        .values({ ...report, timestamp: new Date(), trust: 1 })
        .returning({
            reportId: reports.reportId,
            stationId: reports.stationId,
            lineId: reports.lineId,
            directionId: reports.directionId,
            timestamp: reports.timestamp,
        })

    const created = createdRows.at(0)
    if (created === undefined) throw new Error('D1 did not return the inserted preview report')
    return { ...created, timestamp: created.timestamp.toISOString() }
}
