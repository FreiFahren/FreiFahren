import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { z } from 'zod'

import type { Env } from '../../app-env'
import { AppError, normalizeInternalCode } from '../../common/errors'

import { isOpenReportPreview, submitOpenPreviewReport } from './preview-report-gate'
import type {
    NormalizedReport,
    ReportGateResult,
    TrustedReportGate,
    TrustedReportGateIntakeRequest,
} from './report-gate-contract'

export type { NormalizedReport } from './report-gate-contract'

export const TURNSTILE_TOKEN_HEADER = 'cf-turnstile-response'

const createdReportSchema = z.object({
    reportId: z.number().int(),
    stationId: z.string(),
    lineId: z.string().nullable(),
    directionId: z.string().nullable(),
    timestamp: z.string(),
})

const viewerSchema = z.object({
    clientHash: z.string().nullable(),
    minStationTrust: z.number().nonnegative(),
})

export const assertPublicReportIntakeEnabled = (c: Context<Env>): void => {
    if (isOpenReportPreview(c) || c.get('city').reporting.publicSubmissionsEnabled) return
    throw new AppError({
        message: 'Reporting is temporarily disabled',
        statusCode: 503,
        internalCode: 'REPORTING_DISABLED',
    })
}

const cityDescriptor = (c: Context<Env>) => {
    const city = c.get('city')
    return {
        slug: city.slug,
        dbBinding: city.dbBinding,
        reporting: { publicSubmissionsEnabled: city.reporting.publicSubmissionsEnabled },
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

const gateResultSchema = z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), data: z.unknown() }),
    z.object({
        ok: z.literal(false),
        error: z.object({
            message: z.string(),
            statusCode: z.number().int().min(400).max(599),
            internalCode: z.string(),
        }),
    }),
])

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
        result = gateResultSchema.parse(await call(gate))
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

export const submitToReportGate = async (c: Context<Env>, report: NormalizedReport) => {
    if (isOpenReportPreview(c)) return submitOpenPreviewReport(c, report)
    assertPublicReportIntakeEnabled(c)

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
        viewerSchema
    )
}

export const submitTrustedReportToGate = (gate: TrustedReportGate | undefined, input: TrustedReportGateIntakeRequest) =>
    callGate(gate, (gate) => gate.intake(input), createdReportSchema)
