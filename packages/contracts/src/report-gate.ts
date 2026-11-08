import { z } from 'zod'

// report-gate's PublicReportsEntrypoint and TrustedTelegramReportsEntrypoint, called by the API.

export const cityDescriptorSchema = z.object({
    slug: z.string().min(1).max(64),
    dbBinding: z.string().regex(/^DB(?:_[A-Z0-9_]+)?$/),
    // Kept as a protocol compatibility field for the deployed gate. Intake is always enabled;
    // emergency blocking is controlled by D1 quarantine state in the API databases.
    reporting: z.object({
        publicSubmissionsEnabled: z.boolean(),
    }),
})

export type CityDescriptor = z.infer<typeof cityDescriptorSchema>

export const requestMetadataSchema = z.object({
    ip: z.string().max(64).default(''),
    userAgent: z.string().max(1024).default(''),
    asn: z.number().int().nonnegative().nullable().default(null),
    asOrganization: z.string().max(256).nullable().default(null),
    platform: z.string().max(64).default('unknown'),
})

export type RequestMetadata = z.infer<typeof requestMetadataSchema>

const normalizedReportFields = {
    stationId: z.string().min(1).max(16),
    lineId: z.string().min(1).max(16).nullable(),
    directionId: z.string().min(1).max(16).nullable(),
}

export const publicNormalizedReportSchema = z.object({
    ...normalizedReportFields,
    source: z.enum(['mini_app', 'web_app', 'mobile_app']),
})

export const trustedTelegramReportSchema = z.object({
    ...normalizedReportFields,
    source: z.literal('telegram'),
})

export type PublicNormalizedReport = z.infer<typeof publicNormalizedReportSchema>

export const normalizedReportSchema = z.union([publicNormalizedReportSchema, trustedTelegramReportSchema])

export type NormalizedReport = z.infer<typeof normalizedReportSchema>

export const intakeRequestSchema = z.object({
    city: cityDescriptorSchema,
    report: publicNormalizedReportSchema,
    request: requestMetadataSchema,
    turnstileToken: z.string().max(4096).optional(),
})

export type IntakeRequest = z.infer<typeof intakeRequestSchema>

export const trustedTelegramIntakeRequestSchema = z.object({
    city: cityDescriptorSchema,
    report: trustedTelegramReportSchema,
})

export type TrustedTelegramIntakeRequest = z.infer<typeof trustedTelegramIntakeRequestSchema>

export const viewerRequestSchema = z.object({
    city: cityDescriptorSchema,
    request: requestMetadataSchema,
})

export type ViewerRequest = z.infer<typeof viewerRequestSchema>

export const createdReportSchema = z.object({
    reportId: z.number().int(),
    stationId: z.string(),
    lineId: z.string().nullable(),
    directionId: z.string().nullable(),
    timestamp: z.string(),
})

export type CreatedReport = z.infer<typeof createdReportSchema>

export const reportViewerSchema = z.object({
    clientHash: z.string().nullable(),
    minStationTrust: z.number().nonnegative(),
})

export type ReportViewer = z.infer<typeof reportViewerSchema>

export const gateErrorSchema = z.object({
    message: z.string(),
    statusCode: z.number().int().min(400).max(599),
    internalCode: z.string(),
})

export type GateError = z.infer<typeof gateErrorSchema>

// RPC can't throw structured errors across Workers, so failures travel as values.
export type ReportGateResult<T> = { ok: true; data: T } | { ok: false; error: GateError }

export const reportGateResultSchema = z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), data: z.unknown() }),
    z.object({ ok: z.literal(false), error: gateErrorSchema }),
])

export type PublicReportGate = {
    intake(request: IntakeRequest): Promise<ReportGateResult<CreatedReport>>
    viewer(request: ViewerRequest): Promise<ReportGateResult<ReportViewer>>
}

export type TrustedReportGate = {
    intake(request: TrustedTelegramIntakeRequest): Promise<ReportGateResult<CreatedReport>>
}
