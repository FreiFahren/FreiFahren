import { CITY_DATABASES, CITY_DATABASE_SLUGS, getCity } from '@freifahren/cities'
import { and, asc, count as countRows, desc, eq, gte, isNull, lt, min, ne, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { DateTime } from 'luxon'

import type { Bindings } from '../../app-env'
import { AppError } from '../../common/errors'
import {
    createD1Db,
    type DbConnection,
    lines,
    reportModeration,
    reportModerationEvents,
    reportQuarantines,
    reports,
    stations,
} from '../../db'

import type { AdminDashboard, AdminReport, ModerationStatus, ReportCounts } from './admin-contract'

const DAY = 86_400_000
const MAX_ROWS = 100_000
export const QUARANTINE_CONFIRMATION = 'QUARANTINE NON-TELEGRAM REPORTS'

const database = (env: Bindings, city: string): DbConnection => {
    const config = CITY_DATABASES[city as keyof typeof CITY_DATABASES]
    const d1 = env[config.dbBinding]
    if (d1 === undefined) {
        throw new AppError({ message: 'City database unavailable', statusCode: 503, internalCode: 'ADMIN_UNAVAILABLE' })
    }
    return createD1Db(d1)
}

const cityMetadata = (city: string) => ({
    city,
    displayName: getCity(city)?.displayName ?? city,
    timezone: getCity(city)?.timezone ?? 'Europe/Berlin',
})

const loadModerationState = async (db: DbConnection) => {
    const [state] = await db
        .select({ enabled: reportModeration.enabled, changedAt: reportModeration.changedAt })
        .from(reportModeration)
        .where(eq(reportModeration.id, 1))
        .limit(1)
    return state ?? null
}

const loadModerationCounts = async (db: DbConnection) => {
    const [heldResult, eligibleResult] = await Promise.all([
        db.select({ value: countRows() }).from(reportQuarantines),
        db
            .select({ value: countRows() })
            .from(reports)
            .leftJoin(reportQuarantines, eq(reportQuarantines.reportId, reports.reportId))
            .where(and(ne(reports.source, 'telegram'), isNull(reportQuarantines.reportId))),
    ])
    return { held: heldResult[0]?.value ?? 0, eligible: eligibleResult[0]?.value ?? 0 }
}

const loadModerationEvents = async (db: DbConnection) =>
    db
        .select({ enabled: reportModerationEvents.enabled, timestamp: reportModerationEvents.timestamp })
        .from(reportModerationEvents)
        .orderBy(desc(reportModerationEvents.id))
        .limit(5)

const loadCityModerationStatus = async (env: Bindings, city: string): Promise<ModerationStatus> => {
    try {
        const db = database(env, city)
        const [state, counts, events] = await Promise.all([
            loadModerationState(db),
            loadModerationCounts(db),
            loadModerationEvents(db),
        ])
        return {
            ...cityMetadata(city),
            enabled: state?.enabled ?? false,
            changedAt: state?.changedAt ?? null,
            ...counts,
            error: null,
            events,
        }
    } catch {
        return {
            ...cityMetadata(city),
            enabled: null,
            changedAt: null,
            held: 0,
            eligible: 0,
            events: [],
            error: 'Database unavailable; emergency state unknown',
        }
    }
}

export const moderationStatus = async (env: Bindings): Promise<ModerationStatus[]> =>
    Promise.all(CITY_DATABASE_SLUGS.map((city) => loadCityModerationStatus(env, city)))

type BatchStatement = BatchItem<'sqlite'>

const moderationStateStatements = (
    db: DbConnection,
    state: Awaited<ReturnType<typeof loadModerationState>>,
    enabled: boolean,
    now: number
): BatchStatement[] => {
    const changed = state === null ? enabled : state.enabled !== enabled
    const shouldWriteState = state === null || changed
    if (!shouldWriteState) return []

    return [
        ...(changed ? [db.insert(reportModerationEvents).values({ enabled, timestamp: now })] : []),
        state === null
            ? db.insert(reportModeration).values({ id: 1, enabled, changedAt: now })
            : db.update(reportModeration).set({ enabled, changedAt: now }).where(eq(reportModeration.id, 1)),
    ]
}

const quarantineStatements = (db: DbConnection, enabled: boolean, now: number): BatchStatement[] => {
    if (!enabled) return []

    return [
        db
            .insert(reportQuarantines)
            .select(
                db
                    .select({
                        reportId: reports.reportId,
                        originalTrust: reports.trust,
                        // D1 requires a value for every destination column in an insert-select.
                        quarantinedAt: sql<number>`${now}`.as('quarantinedAt'),
                    })
                    .from(reports)
                    .where(ne(reports.source, 'telegram'))
            )
            .onConflictDoNothing(),
        db.update(reports).set({ trust: 0 }).where(ne(reports.source, 'telegram')),
    ]
}

const runBatch = async (db: DbConnection, statements: BatchStatement[]) => {
    if (statements.length === 0) return
    await db.batch(statements as [BatchStatement, ...BatchStatement[]])
}

const setCityQuarantine = async (env: Bindings, city: string, enabled: boolean, now: number) => {
    const db = database(env, city)
    const state = await loadModerationState(db)
    const statements = [
        ...moderationStateStatements(db, state, enabled, now),
        ...quarantineStatements(db, enabled, now),
    ]
    await runBatch(db, statements)
}

export const setQuarantine = async (env: Bindings, enabled: boolean) => {
    const now = Date.now()
    // Keep writes ordered because local development maps every city binding to one D1 database.
    // Serial writes are also easier to retry safely when an individual city is unavailable.
    const results: PromiseSettledResult<void>[] = []
    for (const city of CITY_DATABASE_SLUGS) {
        try {
            await setCityQuarantine(env, city, enabled, now)
            results.push({ status: 'fulfilled', value: undefined })
        } catch (reason) {
            results.push({ status: 'rejected', reason })
        }
    }
    const cities = await moderationStatus(env)
    const complete =
        results.every((result) => result.status === 'fulfilled') && cities.every((city) => city.enabled === enabled)
    return { complete, cities }
}

type StoredReport = {
    reportId: number
    timestamp: Date
    stationId: string
    station: string | null
    line: string | null
    source: string
    trust: number | null
    trustFlags: string | null
    clientHash: string | null
    asn: number | null
    asOrganization: string | null
    quarantineReportId: number | null
    originalTrust: number | null
}

// Diagnostics are data, not a registry of scoring rules. String storage is the current
// format; arrays/objects are accepted so adding or renaming a flag needs no UI release.
export const parseFlags = (value: string | null): string[] => {
    if (value === null || value.trim() === '') return []
    let names: string[]
    try {
        const parsed: unknown = JSON.parse(value)
        if (Array.isArray(parsed)) names = parsed.filter((item): item is string => typeof item === 'string')
        else if (parsed !== null && typeof parsed === 'object')
            names = Object.entries(parsed)
                .filter(([, active]) => Boolean(active))
                .map(([key]) => key)
        else names = [String(parsed)]
    } catch {
        names = value.split(',')
    }
    return [...new Set(names.map((name) => name.trim()).filter(Boolean))]
}

const emptyCounts = (): ReportCounts => ({
    total: 0,
    positive: 0,
    zero: 0,
    legacy: 0,
    held: 0,
    quarantined: 0,
    effectivePositive: 0,
})
const count = (counts: ReportCounts, report: AdminReport) => {
    counts.total++
    if (report.gateTrust === null) counts.legacy++
    else if (report.gateTrust > 0) counts.positive++
    else counts.zero++
    if (report.held) counts.held++
    if (report.trust === 0) counts.quarantined++
    if (report.trust !== null && report.trust > 0) counts.effectivePositive++
}
const countKeys = Object.keys(emptyCounts()) as (keyof ReportCounts)[]

export type DashboardQuery = {
    from: string
    to: string
    bucket: number
    scope: string
    source?: string
    flag?: string
    outcome?: 'positive' | 'zero' | 'legacy' | 'held'
    offset: number
}

const toAdminReport = (row: StoredReport, city: string): AdminReport => ({
    id: row.reportId,
    city,
    timestamp: row.timestamp.getTime(),
    source: row.source,
    stationId: row.stationId,
    station: row.station ?? row.stationId,
    line: row.line,
    trust: row.trust,
    gateTrust: row.quarantineReportId !== null ? row.originalTrust : row.trust,
    flags: parseFlags(row.trustFlags),
    held: row.quarantineReportId !== null,
    clientHash: row.clientHash,
    network: row.asn === null ? null : `AS${row.asn}${row.asOrganization !== null ? ` · ${row.asOrganization}` : ''}`,
})

const loadCityReports = async (env: Bindings, city: string, from: number, to: number) => {
    try {
        const db = database(env, city)
        const [result, coverage, flags] = await Promise.all([
            db
                .select({
                    reportId: reports.reportId,
                    timestamp: reports.timestamp,
                    stationId: reports.stationId,
                    station: stations.name,
                    line: lines.name,
                    source: reports.source,
                    trust: reports.trust,
                    trustFlags: reports.trustFlags,
                    clientHash: reports.clientHash,
                    asn: reports.asn,
                    asOrganization: reports.asOrganization,
                    quarantineReportId: reportQuarantines.reportId,
                    originalTrust: reportQuarantines.originalTrust,
                })
                .from(reports)
                .leftJoin(stations, eq(stations.id, reports.stationId))
                .leftJoin(lines, eq(lines.id, reports.lineId))
                .leftJoin(reportQuarantines, eq(reportQuarantines.reportId, reports.reportId))
                .where(and(gte(reports.timestamp, new Date(from)), lt(reports.timestamp, new Date(to))))
                .orderBy(asc(reports.timestamp))
                .limit(MAX_ROWS + 1),
            db.select({ first: min(reports.timestamp) }).from(reports),
            db.selectDistinct({ trustFlags: reports.trustFlags, source: reports.source }).from(reports),
        ])
        if (result.length > MAX_ROWS)
            throw new AppError({
                message: 'Narrow the time range or select one city',
                statusCode: 422,
                internalCode: 'ADMIN_RANGE_TOO_LARGE',
            })
        return {
            rows: result.map((row) => toAdminReport(row, city)),
            first: coverage[0]?.first?.getTime() ?? null,
            flags,
        }
    } catch (error) {
        if (error instanceof AppError) throw error
        throw new AppError({
            message: 'City report data unavailable',
            statusCode: 503,
            internalCode: 'ADMIN_UNAVAILABLE',
            description: `Failed to read ${city}`,
        })
    }
}

const matchesFilters = (row: AdminReport, query: DashboardQuery) => {
    if (query.source !== undefined && row.source !== query.source) return false
    if (query.flag !== undefined && !row.flags.includes(query.flag)) return false
    switch (query.outcome) {
        case 'positive':
            return row.gateTrust !== null && row.gateTrust > 0
        case 'zero':
            return row.gateTrust === 0
        case 'legacy':
            return row.gateTrust === null
        case 'held':
            return row.held
        default:
            return true
    }
}

const scoreBand = (score: number | null) => {
    if (score === null) return 'Unscored'
    if (score <= 0) return 'Zero'
    if (score < 0.25) return '0 < score < 0.25'
    if (score < 1) return '0.25 ≤ score < 1'
    return 'Score ≥ 1'
}

type StationSummary = { name: string; count: number; positive: number }
type ClientSummary = { name: string; count: number; positive: number; stationIds: Set<string> }
type NetworkSummary = { name: string; count: number; positive: number }
type SummaryAccumulator = {
    totals: ReportCounts
    noFlags: ReportCounts
    sourceCounts: Map<string, ReportCounts>
    flagCounts: Map<string, ReportCounts>
    stations: Map<string, StationSummary>
    clients: Map<string, ClientSummary>
    networks: Map<string, NetworkSummary>
    trustDistribution: Map<string, number>
}

const createSummaryAccumulator = (knownFlags: Set<string>): SummaryAccumulator => ({
    totals: emptyCounts(),
    noFlags: emptyCounts(),
    sourceCounts: new Map(),
    flagCounts: new Map([...knownFlags].sort().map((flag) => [flag, emptyCounts()])),
    stations: new Map(),
    clients: new Map(),
    networks: new Map(),
    trustDistribution: new Map(
        ['Unscored', 'Zero', '0 < score < 0.25', '0.25 ≤ score < 1', 'Score ≥ 1'].map((name) => [name, 0])
    ),
})

const addCountMapEntry = (map: Map<string, ReportCounts>, key: string, row: AdminReport) => {
    const counts = map.get(key) ?? emptyCounts()
    count(counts, row)
    map.set(key, counts)
}

const addStation = (stations: Map<string, StationSummary>, row: AdminReport) => {
    const key = `${row.city}:${row.stationId}`
    const station = stations.get(key) ?? {
        name: `${row.station} · ${getCity(row.city)?.displayName ?? row.city}`,
        count: 0,
        positive: 0,
    }
    station.count++
    if (row.gateTrust !== null && row.gateTrust > 0) station.positive++
    stations.set(key, station)
}

const addClient = (clients: Map<string, ClientSummary>, row: AdminReport) => {
    if (row.clientHash === null) return
    const key = `${row.city}:${row.clientHash}`
    const client = clients.get(key) ?? { name: key, count: 0, positive: 0, stationIds: new Set<string>() }
    client.count++
    if (row.gateTrust !== null && row.gateTrust > 0) client.positive++
    client.stationIds.add(row.stationId)
    clients.set(key, client)
}

const addNetwork = (networks: Map<string, NetworkSummary>, row: AdminReport) => {
    const name = row.network ?? 'Not recorded'
    const network = networks.get(name) ?? { name, count: 0, positive: 0 }
    network.count++
    if (row.gateTrust !== null && row.gateTrust > 0) network.positive++
    networks.set(name, network)
}

const addReportToSummary = (summary: SummaryAccumulator, row: AdminReport) => {
    count(summary.totals, row)
    addCountMapEntry(summary.sourceCounts, row.source, row)
    if (row.flags.length === 0) count(summary.noFlags, row)
    for (const flag of row.flags) addCountMapEntry(summary.flagCounts, flag, row)
    const band = scoreBand(row.gateTrust)
    summary.trustDistribution.set(band, (summary.trustDistribution.get(band) ?? 0) + 1)
    addStation(summary.stations, row)
    addClient(summary.clients, row)
    addNetwork(summary.networks, row)
}

const finalizeSummary = (summary: SummaryAccumulator) => ({
    totals: summary.totals,
    noFlags: summary.noFlags,
    sources: [...summary.sourceCounts].map(([name, counts]) => ({ name, ...counts })).sort((a, b) => b.total - a.total),
    flags: [...summary.flagCounts]
        .map(([name, counts]) => ({ name, ...counts }))
        .sort((a, b) => (b.total - a.total !== 0 ? b.total - a.total : a.name.localeCompare(b.name))),
    trustDistribution: [...summary.trustDistribution].map(([name, count]) => ({ name, count })),
    stations: [...summary.stations.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    clients: [...summary.clients.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
        .map(({ stationIds, ...client }) => ({ ...client, stations: stationIds.size })),
    networks: [...summary.networks.values()].sort((a, b) => b.count - a.count).slice(0, 8),
})

const summarizeReports = (selected: AdminReport[], knownFlags: Set<string>) => {
    const summary = createSummaryAccumulator(knownFlags)
    for (const row of selected) addReportToSummary(summary, row)
    return finalizeSummary(summary)
}

type TimelineBucket = ReportCounts & { sources: Record<string, number>; flags: Record<string, number> }

const emptyTimelineBucket = (): TimelineBucket => ({ ...emptyCounts(), sources: {}, flags: {} })

const bucketStart = (timestamp: number, interval: number, timezone: string) => {
    const local = DateTime.fromMillis(timestamp, { zone: timezone })
    const startOfDay = local.startOf('day')
    if (interval === DAY) return startOfDay.toMillis()
    const elapsed = timestamp - startOfDay.toMillis()
    return startOfDay.plus({ milliseconds: Math.floor(elapsed / interval) * interval }).toMillis()
}

const nextBucketStart = (timestamp: number, interval: number, timezone: string) => {
    const local = DateTime.fromMillis(timestamp, { zone: timezone })
    if (interval === DAY) return local.plus({ days: 1 }).startOf('day').toMillis()
    const startOfDay = local.startOf('day')
    const elapsed = timestamp - startOfDay.toMillis()
    return startOfDay.plus({ milliseconds: (Math.floor(elapsed / interval) + 1) * interval }).toMillis()
}

const previousDayBucket = (timestamp: number, day: number, timezone: string) =>
    DateTime.fromMillis(timestamp, { zone: timezone }).minus({ days: day }).toMillis()

const bucketReports = (rows: AdminReport[], from: number, interval: number, timezone: string) => {
    const byBucket = new Map<number, TimelineBucket>()
    const firstBucket = bucketStart(from, interval, timezone)
    for (const row of rows) {
        const timestamp = bucketStart(row.timestamp, interval, timezone)
        const bucket = byBucket.get(timestamp) ?? emptyTimelineBucket()
        // The first visible bucket may start mid-interval; don't include its out-of-range reports.
        if (timestamp < firstBucket || row.timestamp >= from) {
            count(bucket, row)
            bucket.sources[row.source] = (bucket.sources[row.source] ?? 0) + 1
            for (const flag of row.flags) bucket.flags[flag] = (bucket.flags[flag] ?? 0) + 1
        }
        byBucket.set(timestamp, bucket)
    }
    return byBucket
}

const expectedForBucket = (
    byBucket: Map<number, TimelineBucket>,
    timestamp: number,
    coverageStart: number,
    timezone: string
) => {
    const expected = emptyCounts()
    const sources: Record<string, number> = {}
    const flags: Record<string, number> = {}
    let samples = 0
    let scoredSamples = 0
    for (let day = 1; day <= 7; day++) {
        const previous = previousDayBucket(timestamp, day, timezone)
        if (previous < coverageStart) continue
        const sample = byBucket.get(previous) ?? emptyTimelineBucket()
        for (const key of countKeys) expected[key] += sample[key]
        for (const [source, value] of Object.entries(sample.sources)) sources[source] = (sources[source] ?? 0) + value
        for (const [flag, value] of Object.entries(sample.flags)) flags[flag] = (flags[flag] ?? 0) + value
        samples++
        if (sample.positive + sample.zero > 0) scoredSamples++
    }
    return { expected, sources, flags, samples, scoredSamples }
}

const buildTimelineBucket = (
    byBucket: Map<number, TimelineBucket>,
    timestamp: number,
    to: number,
    from: number,
    interval: number,
    coverageStart: number,
    timezone: string
): AdminDashboard['series'][number] => {
    const current = byBucket.get(timestamp) ?? emptyTimelineBucket()
    const { expected, sources, flags, samples, scoredSamples } = expectedForBucket(
        byBucket,
        timestamp,
        coverageStart,
        timezone
    )
    const end = nextBucketStart(timestamp, interval, timezone)
    const duration = end - timestamp
    const fraction = (Math.min(to, end) - Math.max(from, timestamp)) / duration
    for (const key of countKeys) expected[key] = samples > 0 ? (expected[key] / samples) * fraction : 0
    const expectedSources = Object.fromEntries(
        Object.entries(sources).map(([name, value]) => [name, samples > 0 ? (value / samples) * fraction : 0])
    )
    const expectedFlags = Object.fromEntries(
        Object.entries(flags).map(([name, value]) => [name, samples > 0 ? (value / samples) * fraction : 0])
    )
    // Legacy intervals are missing scoring history, not zero positive traffic.
    const positiveBaseline = scoredSamples > 0 ? (expected.positive * samples) / scoredSamples : 0
    const sourceAnomalies = Object.entries(current.sources)
        .filter(([name, value]) => value >= Math.max(3, (expectedSources[name] ?? 0) * 3))
        .map(([name]) => name)
        .sort()
    const flagAnomalies = Object.entries(current.flags)
        .filter(([name, value]) => value >= Math.max(3, (expectedFlags[name] ?? 0) * 3))
        .map(([name]) => name)
        .sort()
    const spike =
        samples >= 3 &&
        (current.total >= Math.max(10, expected.total * 3) ||
            (scoredSamples >= 3 && current.positive >= Math.max(10, positiveBaseline * 3)) ||
            sourceAnomalies.length > 0 ||
            flagAnomalies.length > 0)
    return {
        ...current,
        timestamp,
        expected: samples >= 3 ? expected : null,
        partial: fraction < 0.999,
        spike,
        anomalies: { sources: sourceAnomalies, flags: flagAnomalies },
    }
}

const buildTimeline = (
    rows: AdminReport[],
    from: number,
    to: number,
    interval: number,
    coverageStart: number,
    timezone: string
) => {
    const byBucket = bucketReports(rows, from, interval, timezone)
    const series: AdminDashboard['series'] = []
    // A baseline uses only preceding days, including zero-report intervals. Replaying
    // An incident therefore cannot learn from traffic that hadn't happened yet.
    for (
        let timestamp = bucketStart(from, interval, timezone);
        timestamp < to;
        timestamp = nextBucketStart(timestamp, interval, timezone)
    ) {
        series.push(buildTimelineBucket(byBucket, timestamp, to, from, interval, coverageStart, timezone))
    }
    return series
}

export const getDashboard = async (env: Bindings, query: DashboardQuery): Promise<AdminDashboard> => {
    const from = Date.parse(query.from)
    const to = Date.parse(query.to)
    const interval = query.bucket * 60_000
    const citySlugs = query.scope === 'all' ? [...CITY_DATABASE_SLUGS] : [query.scope]
    const results = await Promise.all(
        citySlugs.map((city) => loadCityReports(env, city, from - 7 * DAY - interval, to))
    )
    const earliest = results.flatMap((result) => (result.first === null ? [] : [result.first]))
    const knownFlags = new Set(results.flatMap((result) => result.flags.flatMap((row) => parseFlags(row.trustFlags))))
    const knownSources = new Set(results.flatMap((result) => result.flags.map((row) => row.source)))
    const rows = results.flatMap((result) => result.rows).filter((row) => matchesFilters(row, query))
    const selected = rows.filter((row) => row.timestamp >= from)
    const timezones = citySlugs
        .map((city) => getCity(city)?.timezone)
        .filter((timezone): timezone is string => timezone !== undefined)
    const timelineTimezone = new Set(timezones).size === 1 ? timezones[0]! : 'UTC'
    return {
        generatedAt: Date.now(),
        snapshotAt: env.ADMIN_DATA_SNAPSHOT_AT ?? null,
        from,
        to,
        bucketMinutes: query.bucket,
        ...summarizeReports(selected, knownFlags),
        series: buildTimeline(
            rows,
            from,
            to,
            interval,
            earliest.length > 0 ? Math.max(...earliest) : Infinity,
            timelineTimezone
        ),
        reports: selected
            .sort((a, b) => (a.timestamp !== b.timestamp ? b.timestamp - a.timestamp : b.id - a.id))
            .slice(query.offset, query.offset + 50),
        reportCount: selected.length,
        offset: query.offset,
        knownSources: [...knownSources].sort(),
        cities: citySlugs,
    }
}
