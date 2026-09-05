export type CityDescriptor = {
    slug: string
    publicAppUrl: string
    dbBinding: string
    telegramChatId: string | null
    reporting: {
        publicSubmissionsEnabled: boolean
        telegramForwardingEnabled: boolean
    }
}

export type RequestMetadata = {
    ip: string
    userAgent: string
    asn: number | null
    asOrganization: string | null
    platform: string
}

export type NormalizedReport = {
    stationId: string
    lineId: string | null
    directionId: string | null
    source: 'mini_app' | 'web_app' | 'mobile_app' | 'telegram'
}

export type ReportGateIntakeRequest = {
    city: CityDescriptor
    report: NormalizedReport
    request: RequestMetadata
    turnstileToken?: string
}

export type ReportGateViewerRequest = {
    city: CityDescriptor
    request: RequestMetadata
}

export type CreatedReport = {
    reportId: number
    stationId: string
    lineId: string | null
    directionId: string | null
    timestamp: string
}

export type ReportViewer = {
    clientHash: string | null
    minStationTrust: number
}

export type ReportGateResult<T> =
    | { ok: true; data: T }
    | {
          ok: false
          error: {
              message: string
              statusCode: number
              internalCode: string
          }
      }

export type PublicReportGate = {
    intake(request: ReportGateIntakeRequest): Promise<ReportGateResult<CreatedReport>>
    viewer(request: ReportGateViewerRequest): Promise<ReportGateResult<ReportViewer>>
}

export type TrustedReportGateIntakeRequest = {
    city: CityDescriptor
    report: NormalizedReport & { source: 'telegram' }
}

export type TrustedReportGate = {
    intake(request: TrustedReportGateIntakeRequest): Promise<ReportGateResult<CreatedReport>>
}
