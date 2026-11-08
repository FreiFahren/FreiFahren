import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import {
    createdReportSchema,
    type PublicNormalizedReport,
    reportGateResultSchema,
    type ReportGateResult,
    reportViewerSchema,
    type TrustedReportGate,
    type TrustedTelegramIntakeRequest,
} from '@freifahren/contracts/report-gate'
import { z } from 'zod'

import type { Env } from '../../app-env'
import { AppError, normalizeInternalCode } from '../../common/errors'

import { isOpenReportPreview, submitOpenPreviewReport } from './preview-report-gate'

export type { NormalizedReport } from '@freifahren/contracts/report-gate'

export const TURNSTILE_TOKEN_HEADER = 'cf-turnstile-response'

const cityDescriptor = (c: Context<Env>) => {
    const city = c.get('city')
    return {
        slug: city.slug,
        dbBinding: city.dbBinding,
        reporting: { publicSubmissionsEnabled: true },
    }
}

const requestMetadata = (c: Context<Env>) => {
    const cf = c.req.raw.cf
    return {
        ip: c.req.header('CF-Connecting-IP') ?? '',
        userAgent: c.req.header('User-Agent') ?? '',
        asn: typeof cf?.asn === 'number' ? cf.asn : null,
        asOrganization: typeof cf?.asOrganization === 'string' ? cf.asOrganization : null,
        platform: c.req.header('ff-platform') ?? 'unknown',
    }
}

const reportGateUnavailable = (error?: unknown) =>
    new AppError({
        message: 'Reporting service is unavailable',
        statusCode: 503,
        internalCode: 'REPORT_GATE_UNAVAILABLE',
        description: error === undefined ? undefined : error instanceof Error ? error.message : String(error),
    })

const callGate = async <Gate, Data>(
    gate: Gate | undefined,
    call: (gate: Gate) => Promise<ReportGateResult<unknown>>,
    dataSchema: z.ZodType<Data>
): Promise<Data> => {
    if (gate === undefined) throw reportGateUnavailable()

    let result: ReportGateResult<unknown>
    try {
        result = reportGateResultSchema.parse(await call(gate))
    } catch (error) {
        throw reportGateUnavailable(error)
    }

    if (!result.ok) {
        throw new AppError({
            message: result.error.message,
            statusCode: result.error.statusCode as ContentfulStatusCode,
            internalCode: normalizeInternalCode(result.error.internalCode),
        })
    }
    try {
        return dataSchema.parse(result.data)
    } catch (error) {
        throw reportGateUnavailable(error)
    }
}

export const submitToReportGate = async (c: Context<Env>, report: PublicNormalizedReport) => {
    if (isOpenReportPreview(c)) return submitOpenPreviewReport(c, report)
    return callGate(
        c.env.REPORT_GATE,
        (gate) =>
            gate.intake({
                city: cityDescriptor(c),
                report,
                request: requestMetadata(c),
                turnstileToken: c.req.header(TURNSTILE_TOKEN_HEADER),
            }),
        createdReportSchema
    )
}

export const resolveReportViewer = async (c: Context<Env>) => {
    if (isOpenReportPreview(c)) return { clientHash: null, minStationTrust: 0 }

    return callGate(
        c.env.REPORT_GATE,
        (gate) => gate.viewer({ city: cityDescriptor(c), request: requestMetadata(c) }),
        reportViewerSchema
    )
}

export const submitTrustedReportToGate = (gate: TrustedReportGate | undefined, input: TrustedTelegramIntakeRequest) =>
    callGate(gate, (gate) => gate.intake(input), createdReportSchema)
