export type ReportCounts = {
    total: number
    positive: number
    zero: number
    legacy: number
    held: number
    quarantined: number
    effectivePositive: number
}

export type AdminReport = {
    id: number
    city: string
    timestamp: number
    source: string
    stationId: string
    station: string
    line: string | null
    trust: number | null
    gateTrust: number | null
    flags: string[]
    held: boolean
    clientHash: string | null
    network: string | null
}

export type ModerationStatus = {
    city: string
    displayName: string
    timezone: string
    enabled: boolean | null
    changedAt: number | null
    held: number
    eligible: number
    error: string | null
    events: { enabled: boolean; timestamp: number }[]
}

export type AdminStatus = {
    cities: ModerationStatus[]
    snapshotAt: string | null
}

export type AdminDashboard = {
    generatedAt: number
    snapshotAt: string | null
    from: number
    to: number
    bucketMinutes: number
    totals: ReportCounts
    series: (ReportCounts & {
        timestamp: number
        expected: ReportCounts | null
        partial: boolean
        sources: Record<string, number>
        spike: boolean
    })[]
    sources: (ReportCounts & { name: string })[]
    flags: (ReportCounts & { name: string })[]
    noFlags: ReportCounts
    trustDistribution: { name: string; count: number }[]
    stations: { name: string; count: number; positive: number }[]
    clients: { name: string; count: number; stations: number; positive: number }[]
    networks: { name: string; count: number; positive: number }[]
    reports: AdminReport[]
    reportCount: number
    offset: number
    knownSources: string[]
    cities: string[]
}
export const ADMIN_API_PATH = '/admin/v1'
