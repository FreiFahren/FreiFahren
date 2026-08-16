import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { z } from 'zod'

import { AppError } from '../../common/errors'
import { DbConnection, InsertReport, reports } from '../../db/'
import type { TransitNetworkDataService } from '../transit/transit-network-data-service'
import type { StationId } from '../transit/types'

import { ANONYMOUS_CLIENT, type ClientIdentity } from './client-identity'
import {
    assignLineIfSingleOption,
    clearStationReferenceIfNotOnLine,
    correctDirectionIfImplied,
    determineLineBasedOnStationAndDirection,
    guessStation,
    pipeAsync,
    RawReport,
    clearDirectionIfStationAndDirectionAreTheSame,
    ifDirectionPresentWithoutLineClearDirection,
    assertKnownStationReference,
} from './post-process-report'
import { annotateReportExpiry, isLive } from './report-decay'

const MIN_PREDICTED_REPORTS_THRESHOLD = 1
const MAX_PREDICTED_REPORTS_THRESHOLD = 7

type LuxonWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

const isWeekend = (weekday: LuxonWeekday): boolean => weekday === 6 || weekday === 7

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const calculateBasePredictedReportsThreshold = (currentTime: DateTime): number => {
    const minutesPastMidnight = currentTime.hour * 60 + currentTime.minute

    const isSaturday = currentTime.weekday === 6

    if (minutesPastMidnight >= 18 * 60 && isSaturday && minutesPastMidnight < 24 * 60) {
        // On Saturdays, decrease linearly from 18:00 to 24:00
        return 7 - (minutesPastMidnight - 18 * 60) * (6.0 / (6 * 60))
    }

    if (minutesPastMidnight >= 18 * 60 && minutesPastMidnight < 21 * 60) {
        // On other days, decrease linearly from 18:00 to 21:00
        return 7 - (minutesPastMidnight - 18 * 60) * (6.0 / (3 * 60))
    }

    if (minutesPastMidnight >= 21 * 60 || minutesPastMidnight < 7 * 60) {
        // Stay at 1 between 21:00 to 7:00
        return 1
    }

    if (minutesPastMidnight >= 7 * 60 && minutesPastMidnight < 9 * 60) {
        // Increase linearly from 7:00 to 9:00
        return 1 + (minutesPastMidnight - 7 * 60) * (6.0 / (2 * 60))
    }

    return 7
}

const calculateWeekendAdjustment = (currentTime: DateTime, baseThreshold: number): number => {
    if (!isWeekend(currentTime.weekday as LuxonWeekday)) return 0

    const truncatedBase = Math.trunc(baseThreshold)
    return truncatedBase * 0.5
}

// Returns the integer threshold that controls how many predicted/historic reports we should show.
export const calculatePredictedReportsThreshold = (currentTime: DateTime): number => {
    const base = calculateBasePredictedReportsThreshold(currentTime)
    const adjustment = calculateWeekendAdjustment(currentTime, base)
    const threshold = base - adjustment

    return Math.trunc(clamp(threshold, MIN_PREDICTED_REPORTS_THRESHOLD, MAX_PREDICTED_REPORTS_THRESHOLD))
}

type TelegramNotificationPayload = {
    lineId: string | null
    stationId: StationId
    directionId: StationId | null
}

type RawReportSummary = Pick<typeof reports.$inferSelect, 'timestamp' | 'stationId' | 'directionId' | 'lineId'> & {
    isPredicted: boolean
}

/*
 * `expiresAt` is when the report stops counting as live (see report-decay.ts), serialised as an ISO
 * instant like `timestamp`. It can be in the past: a historical query returns reports that expired
 * long ago, and whether that matters is the caller's business. `null` means the report never
 * expires — only predicted reports, which stand in for missing data rather than describing an event
 * that ages.
 */
type ReportSummary = RawReportSummary & { expiresAt: Date | null }

/*
 * Who is asking. `clientHash` is the requester's own signature, computed the same way intake
 * computes it, and it is what makes suppression invisible to the suppressed: a client always sees
 * its own reports whatever they scored. Somebody flooding the map watches their reports appear
 * exactly as before, learns nothing, and keeps using an approach that reaches nobody else.
 */
export type ViewerContext = {
    minStationTrust: number
    clientHash?: string
    /*
     * Called when any station in the result failed the threshold, whether or not the viewer owned
     * a report there. The station-scoped route uses it to skip edge caching.
     *
     * It has to fire on the shared, empty answer too, not just on the owner's personalised one.
     * The edge keys by URL, never by client: cache the empty list a non-owner gets and the owner's
     * next request is served that same empty list without reaching the worker, which is precisely
     * the moment they learn they have been suppressed.
     */
    onSuppressed?: () => void
}

type ScoredRow = {
    timestamp: Date
    stationId: string
    directionId: string | null
    lineId: string | null
    trust: number | null
    clientHash: string | null
}

/*
 * A station shows when the trust of its reports adds up to the configured threshold — so one
 * ordinary report (scoring 1) is enough at the default of 1, while several flagged ones are not.
 * That is the point: an attacker spreading one report per station to cover the most ground gets
 * nothing shown, and concentrating enough reports on a single station to clear the bar costs them
 * the spread that made it worth doing.
 *
 * An unscored report counts as 1. Scoring is asynchronous and can lag or fail, and treating "not
 * yet scored" as untrusted would empty the map every time the scorer hiccuped.
 */
/*
 * Trust values are fractions like 1/(1 + cost), which binary floating point cannot represent
 * exactly, so a sum that should land on the threshold arrives just under it — ten reports scoring
 * 0.1 add up to 0.9999999999999999. Without this a station with exactly enough corroboration stays
 * hidden, and nothing about the numbers would explain why.
 */
const TRUST_SUM_TOLERANCE = 1e-9

export const selectVisibleReports = (
    rows: ScoredRow[],
    viewer: ViewerContext
): { rows: ScoredRow[]; suppressed: boolean } => {
    if (viewer.minStationTrust <= 0) return { rows, suppressed: false }

    const trustByStation = new Map<string, number>()
    for (const row of rows) {
        trustByStation.set(row.stationId, (trustByStation.get(row.stationId) ?? 0) + (row.trust ?? 1))
    }

    let suppressed = false
    const visible = rows.filter((row) => {
        if ((trustByStation.get(row.stationId) ?? 0) >= viewer.minStationTrust - TRUST_SUM_TOLERANCE) return true

        // This station did not clear the bar, so what we return for it depends on who is asking —
        // True even when the answer is an empty list, which is why this is set before the ownership
        // Check rather than inside it.
        suppressed = true
        return viewer.clientHash !== undefined && row.clientHash === viewer.clientHash
    })

    return { rows: visible, suppressed }
}

export type ReportsServiceConfig = {
    nodeEnv: string
    city: string
    telegramWorkerUrl?: string
    reportPassword?: string
}

export class ReportsService {
    constructor(
        private db: DbConnection,
        private transitNetworkDataService: TransitNetworkDataService,
        private config: ReportsServiceConfig
    ) {}

    async getRealReports({
        from,
        to,
        stationId,
        viewer,
    }: {
        from: DateTime
        to: DateTime
        stationId?: StationId
        viewer?: ViewerContext
    }): Promise<RawReportSummary[]> {
        const dbResults = await this.db
            .select({
                timestamp: reports.timestamp,
                stationId: reports.stationId,
                directionId: reports.directionId,
                lineId: reports.lineId,
                trust: reports.trust,
                clientHash: reports.clientHash,
            })
            .from(reports)
            .where(
                and(
                    gte(reports.timestamp, from.toJSDate()),
                    lte(reports.timestamp, to.toJSDate()),
                    stationId !== undefined ? eq(reports.stationId, stationId) : undefined
                )
            )

        const visible = selectVisibleReports(dbResults, viewer ?? { minStationTrust: 0 })
        if (visible.suppressed) viewer?.onSuppressed?.()

        /*
         * Trust and the client signature are dropped here and never reach a response body.
         * Returning either would tell a suppressed client that it has been suppressed, which is the
         * one thing this design cannot afford to leak.
         */
        return visible.rows.map((report) => ({
            timestamp: report.timestamp,
            stationId: report.stationId,
            directionId: report.directionId,
            lineId: report.lineId,
            isPredicted: false,
        }))
    }

    async getReports({
        from,
        to,
        stationId,
        currentTime,
        viewer,
    }: {
        from: DateTime
        to: DateTime
        stationId?: StationId
        currentTime: DateTime
        viewer?: ViewerContext
    }): Promise<ReportSummary[]> {
        const result: ReportSummary[] = await this.getReportsWithExpiry({
            from,
            to,
            stationId,
            currentTime,
            viewer,
        })

        /*
         * Predict reports if we don't have enough, so that users always see at least some data.
         *
         * The threshold counts every report in range, not just the ones still live. An expired
         * report is not a gap in the data to paper over — decay hiding a stale report is a
         * deliberate statement that it is stale, and answering that with synthesised reports would
         * replace "we hid something stale" with "here is something invented". It also keeps
         * historical windows honest: a 24h range full of expired reports has plenty of data and
         * must not be backfilled with predictions.
         */
        const predictedReportsThreshold = calculatePredictedReportsThreshold(currentTime)
        if (result.length < predictedReportsThreshold) {
            const numberOfReportsToFetch = predictedReportsThreshold - result.length
            const reportedStationIds = new Set(result.map((r) => r.stationId as StationId))

            if (stationId !== undefined && reportedStationIds.has(stationId)) return result

            // The allowed-station lookup may read the full station list and the historic
            // Candidate fetch reads recent reports; the two are independent, so issue
            // Them concurrently rather than as back-to-back D1 round-trips.
            const [allowedStationIds, candidateRows] = await Promise.all([
                this.resolveAllowedStationIds(stationId, reportedStationIds),
                this.loadPredictionCandidates(stationId, viewer),
            ])
            const historicReports = this.predictReports(
                numberOfReportsToFetch,
                from,
                to,
                allowedStationIds,
                candidateRows
            )
            // Predicted reports stand in for missing data rather than describing an event that
            // ages, so they have no expiry — see the `ReportSummary` note.
            result.push(...historicReports.map((report) => ({ ...report, expiresAt: null })))
        }

        return result
    }

    /**
     * Real reports in range, each stamped with when it stops being live.
     *
     * Expiry is computed once per request from the whole batch, so every viewer looking at this
     * station/timeframe right now agrees on it: one shared "now", one shared burst rate, one shared
     * view of which reports overtook which. A client deriving it from its own slice would compute a
     * different burst rate from a different set of reports.
     */
    private async getReportsWithExpiry({
        from,
        to,
        stationId,
        currentTime,
        viewer,
    }: {
        from: DateTime
        to: DateTime
        stationId?: StationId
        currentTime: DateTime
        viewer?: ViewerContext
    }): Promise<(RawReportSummary & { expiresAt: Date })[]> {
        const [realReports, lines] = await Promise.all([
            this.getRealReports({ from, to, stationId, viewer }),
            this.transitNetworkDataService.getLines(),
        ])
        return annotateReportExpiry(realReports, lines, currentTime.toMillis())
    }

    /**
     * Only the reports that are live right now — the set the map is showing.
     *
     * The risk model reads through here rather than through `getRealReports` so that risk and
     * markers cannot disagree: a report that has expired off the map paints no risk, which is what
     * makes "a coloured line with no marker on it" impossible by construction rather than by two
     * decay models happening to agree.
     */
    async getLiveReports({
        from,
        to,
        stationId,
        currentTime,
        viewer,
    }: {
        from: DateTime
        to: DateTime
        stationId?: StationId
        currentTime: DateTime
        viewer?: ViewerContext
    }): Promise<RawReportSummary[]> {
        const annotated = await this.getReportsWithExpiry({ from, to, stationId, currentTime, viewer })
        return annotated.filter((report) => isLive(report, currentTime.toMillis()))
    }

    // Determines which stations the prediction algorithm may emit reports for.
    // When the query is scoped to a specific station, predictions are restricted to that station.
    // When the query is unscoped, any station that hasn't already reported is a candidate.
    private async resolveAllowedStationIds(
        stationId: StationId | undefined,
        reportedStationIds: ReadonlySet<StationId>
    ): Promise<ReadonlySet<StationId>> {
        if (stationId !== undefined) {
            return reportedStationIds.has(stationId) ? new Set() : new Set([stationId])
        }

        const allStations = await this.transitNetworkDataService.getStations()
        return new Set((Object.keys(allStations) as StationId[]).filter((id) => !reportedStationIds.has(id)))
    }

    // Recent reports used as the historic sample for prediction. Fetched separately
    // So getReports can run it concurrently with resolveAllowedStationIds.
    private async loadPredictionCandidates(stationId?: StationId, viewer?: ViewerContext) {
        const rows = await this.db
            .select({
                stationId: reports.stationId,
                timestamp: reports.timestamp,
                directionId: reports.directionId,
                lineId: reports.lineId,
                trust: reports.trust,
                clientHash: reports.clientHash,
            })
            .from(reports)
            .where(stationId !== undefined ? eq(reports.stationId, stationId) : undefined)
            .orderBy(desc(reports.timestamp))
            .limit(1000)

        /*
         * Filtered by the same rule as the reports themselves. Prediction infers where inspectors
         * usually are from where they have recently been reported, so leaving suppressed traffic in
         * here would let it shape the map anyway — hidden from the list, then handed straight back
         * as a synthesised report. Nothing about the viewer applies to a historic sample, so this
         * asks only about trust.
         */
        const visible = selectVisibleReports(rows, { minStationTrust: viewer?.minStationTrust ?? 0 })
        return visible.rows.map((row) => ({ stationId: row.stationId, timestamp: row.timestamp }))
    }

    private predictReports(
        numberOfReportsToFetch: number,
        from: DateTime,
        to: DateTime,
        allowedStationIds: ReadonlySet<StationId>,
        candidateRows: Awaited<ReturnType<ReportsService['loadPredictionCandidates']>>
    ): RawReportSummary[] {
        if (numberOfReportsToFetch <= 0) return []
        if (allowedStationIds.size === 0) return []

        // We only want predicted timestamps to appear old, so we constrain them to the first quarter of the requested range.
        // We limit to the first quarter to make it obvious to users that this data is historic/less reliable.
        const fromMillis = from.toMillis()
        const toMillis = to.toMillis()
        const rangeMillis = Math.max(0, toMillis - fromMillis)
        const toRandomDate = (millis: number): Date => new Date(Math.floor(millis))

        const randomTimestampInWindow = (windowStartMillis: number, windowEndMillis: number): Date => {
            const clampedStartMillis = Math.max(fromMillis, Math.min(windowStartMillis, toMillis))
            const clampedEndMillis = Math.max(fromMillis, Math.min(windowEndMillis, toMillis))
            const windowRange = clampedEndMillis - clampedStartMillis
            const millis = clampedStartMillis + Math.random() * windowRange
            return toRandomDate(millis)
        }

        const firstQuarterEndMillis = fromMillis + Math.floor(rangeMillis / 4)
        const firstHalfEndMillis = fromMillis + Math.floor(rangeMillis / 2)

        const usedStationIds = new Set<StationId>()
        const maxUniqueCount = Math.min(numberOfReportsToFetch, allowedStationIds.size)

        const results: RawReportSummary[] = []

        // We only use `guessStation`. If we get a disallowed/duplicate/undefined guess, we broaden the timestamp window
        // (first quarter -> first half -> full range) and retry.
        const windows = [
            { start: fromMillis, end: firstQuarterEndMillis },
            { start: fromMillis, end: firstHalfEndMillis },
            { start: fromMillis, end: toMillis },
        ]

        const triesPerWindow = 25

        for (const window of windows) {
            for (let attempts = 0; attempts < triesPerWindow && results.length < maxUniqueCount; attempts++) {
                const timestamp = randomTimestampInWindow(window.start, window.end)
                const guessTime = DateTime.fromJSDate(timestamp, { zone: 'utc' })

                const guessInput: { stationId?: StationId } = {}
                const guessed = guessStation(candidateRows)(guessTime.hour, guessTime.weekday)(guessInput)

                const stationId = guessed.stationId
                if (stationId === undefined) continue
                if (!allowedStationIds.has(stationId)) continue
                if (usedStationIds.has(stationId)) continue

                usedStationIds.add(stationId)
                results.push({ timestamp, stationId, directionId: null, lineId: null, isPredicted: true })
            }
        }

        // Prediction is inherently best-effort: if we cannot infer enough unique stations from history,
        // We return the subset we managed to infer instead of failing the whole request.
        return results
    }

    /*
     * `client` is a separate argument rather than part of `reportData` on purpose: `reportData` is
     * what the request body validated into, so folding attribution in there would let a caller
     * choose its own. Defaulting to ANONYMOUS_CLIENT keeps every other caller (seeds, tests,
     * telegram relays) storing nulls without having to say so.
     */
    async createReport(
        reportData: InsertReport,
        client: ClientIdentity = ANONYMOUS_CLIENT
    ): Promise<{
        reportId: number
        stationId: string
        lineId: string | null
        directionId: string | null
        timestamp: Date
    }> {
        const [insertedReport] = await this.db
            .insert(reports)
            .values({ ...reportData, ...client, timestamp: new Date() })
            .returning({
                reportId: reports.reportId,
                stationId: reports.stationId,
                lineId: reports.lineId,
                directionId: reports.directionId,
                timestamp: reports.timestamp,
            })
        // Drizzle returns the inserted row for Postgres. If this ever becomes undefined, we want to surface it fast.
        return insertedReport!
    }

    // Skips telegram-sourced reports (they already came from the group) and non-production.
    forwardReportToTelegram(reportData: InsertReport): Promise<void> {
        if (reportData.source === 'telegram' || this.config.nodeEnv !== 'production') {
            return Promise.resolve()
        }
        return this.notifyTelegram(reportData)
    }

    private async notifyTelegram(reportData: InsertReport) {
        const telegramWorkerUrl = z.string().min(1).parse(this.config.telegramWorkerUrl)
        const reportPassword = z.string().min(1).parse(this.config.reportPassword)

        const endpoint = new URL(`${telegramWorkerUrl.replace(/\/$/, '')}/report`)
        endpoint.searchParams.set('city', this.config.city)
        const payload = this.buildTelegramNotificationPayload(reportData)

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Password': reportPassword,
            },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const errorDetail = await response.text().catch(() => 'No response body')
            throw new Error(`Telegram bot notification failed with status ${response.status}: ${errorDetail}`)
        }
    }

    private buildTelegramNotificationPayload(reportData: InsertReport): TelegramNotificationPayload {
        return {
            lineId: reportData.lineId ?? null,
            stationId: reportData.stationId,
            directionId: reportData.directionId ?? null,
        }
    }

    async postProcessReport(reportData: RawReport): Promise<InsertReport> {
        // Independent reads — fetch concurrently instead of back-to-back round-trips.
        const [stations, lines] = await Promise.all([
            this.transitNetworkDataService.getStations(),
            this.transitNetworkDataService.getLines(),
        ])

        const now = DateTime.utc()

        assertKnownStationReference(stations, reportData, 'stationId')
        assertKnownStationReference(stations, reportData, 'directionId')

        const processed = await pipeAsync(
            reportData,
            clearStationReferenceIfNotOnLine(stations, 'stationId'),
            clearStationReferenceIfNotOnLine(stations, 'directionId'),
            assignLineIfSingleOption(stations),
            determineLineBasedOnStationAndDirection(stations),
            correctDirectionIfImplied(lines),
            clearDirectionIfStationAndDirectionAreTheSame,
            ifDirectionPresentWithoutLineClearDirection,
            async (currentReport) => {
                // Avoid guessing the station if we don't have a line
                // Otherwise the guess would be too broad and we would end up with a lot of false positives
                if (
                    currentReport.stationId !== undefined ||
                    currentReport.lineId === null ||
                    currentReport.lineId === undefined
                ) {
                    return currentReport
                }

                const candidateRows = await this.db
                    .select({ stationId: reports.stationId, timestamp: reports.timestamp })
                    .from(reports)
                    .where(eq(reports.lineId, currentReport.lineId))
                    .orderBy(desc(reports.timestamp))
                    .limit(1000)

                return guessStation(candidateRows)(now.hour, now.weekday)(currentReport)
            },
            clearStationReferenceIfNotOnLine(stations, 'stationId'),
            clearStationReferenceIfNotOnLine(stations, 'directionId')
        )

        if (processed.stationId === undefined) {
            throw new AppError({
                message: 'Could not infer station from the provided information',
                statusCode: 422,
                internalCode: 'VALIDATION_FAILED',
                description: `Input data: ${JSON.stringify(reportData)} Current report: ${JSON.stringify(processed)}`,
            })
        }

        return { ...processed, stationId: processed.stationId }
    }
}
