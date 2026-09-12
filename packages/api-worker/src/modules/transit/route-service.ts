import type { CityRoutingConfig, RouteType } from '@freifahren/cities'
import { DateTime } from 'luxon'

import { AppError, NoPathFoundError, StationNotFoundError } from '../../common/errors'
import type { ReportsService, ViewerContext } from '../reports/reports-service'
import { predictRouteRisk, type RiskModelReport, type RiskModelSegment } from '../risk/risk-model'

import { findRoute, type RouteEdge } from './pathfinding'
import type { TransitNetworkDataService } from './transit-network-data-service'
import type { Line, StationId } from './types'

export type RouteLegSegment = {
    /** Null when no seeded segment backs this hop. */
    segmentId: number | null
    fromStationId: StationId
    toStationId: StationId
    offsetSeconds: number
    /** Null when no segment backs this hop, which is not the same as no risk. */
    risk: number | null
}

export type RouteLeg = {
    lineId: string
    lineName: string
    lineColor: string
    lineType: RouteType
    fromStationId: StationId
    toStationId: StationId
    stationIds: StationId[]
    departureOffsetSeconds: number
    arrivalOffsetSeconds: number
    segments: RouteLegSegment[]
}

export type RoutePlan = {
    legs: RouteLeg[]
    totalSeconds: number
    stationCount: number
    transfers: number
    risk: {
        overall: number
        worstSegmentId: number | null
        /** Hops with no segment to score. Above zero, `overall` is an incomplete answer. */
        unratedSegments: number
    }
}

type ResolvedEdge = { edge: RouteEdge; segmentId: number | null }

const segmentKey = (lineId: string, from: StationId, to: StationId): string => `${lineId}|${from}|${to}`

const groupIntoLegs = (
    resolved: ResolvedEdge[],
    // Indexed access is optimistic in TypeScript; a missing score has to stay expressible.
    risks: Record<string, { risk: number } | undefined>,
    linesById: Map<string, Line>
): RouteLeg[] => {
    const legs: RouteLeg[] = []

    for (const { edge, segmentId } of resolved) {
        const segment: RouteLegSegment = {
            segmentId,
            fromStationId: edge.fromStationId,
            toStationId: edge.toStationId,
            offsetSeconds: edge.offsetSeconds,
            risk: segmentId === null ? null : (risks[String(segmentId)]?.risk ?? 0),
        }

        const current = legs.at(-1)
        if (current !== undefined && current.lineId === edge.lineId) {
            current.toStationId = edge.toStationId
            current.stationIds.push(edge.toStationId)
            current.arrivalOffsetSeconds = edge.offsetSeconds + edge.rideSeconds
            current.segments.push(segment)
            continue
        }

        const line = linesById.get(edge.lineId)
        legs.push({
            lineId: edge.lineId,
            lineName: line?.name ?? edge.lineId,
            lineColor: line?.color ?? '#000000',
            lineType: line?.type ?? 'subway',
            fromStationId: edge.fromStationId,
            toStationId: edge.toStationId,
            stationIds: [edge.fromStationId, edge.toStationId],
            departureOffsetSeconds: edge.offsetSeconds,
            arrivalOffsetSeconds: edge.offsetSeconds + edge.rideSeconds,
            segments: [segment],
        })
    }

    return legs
}

const summarize = (legs: RouteLeg[], resolved: ResolvedEdge[]): RoutePlan => {
    const segments = legs.flatMap((leg) => leg.segments)
    const rated = segments.filter((segment) => segment.risk !== null)

    /*
     * The overall level is the worst leg, not a combined probability. The model spreads
     * one report across several neighbouring segments by design, so their values are
     * strongly correlated; treating them as independent (1 - product of complements)
     * would turn ten legs at 0.3 into 0.97 for what is a single inspector.
     */
    const overall = rated.reduce((worst, segment) => Math.max(worst, segment.risk ?? 0), 0)
    const worst = overall > 0 ? rated.find((segment) => segment.risk === overall) : undefined
    const lastEdge = resolved.at(-1)?.edge

    return {
        legs,
        totalSeconds: lastEdge === undefined ? 0 : lastEdge.offsetSeconds + lastEdge.rideSeconds,
        stationCount: resolved.length,
        transfers: Math.max(0, legs.length - 1),
        risk: {
            overall,
            worstSegmentId: worst?.segmentId ?? null,
            unratedSegments: segments.length - rated.length,
        },
    }
}

export class RouteService {
    constructor(
        private transitNetworkDataService: TransitNetworkDataService,
        private reportsService: ReportsService,
        private routing: CityRoutingConfig
    ) {}

    /*
     * Viewer-dependent and time-dependent, so this is computed per request rather than
     * cached — the same reasoning as RiskService.getRisk.
     */
    async getRoute({
        from,
        to,
        viewer,
        now = DateTime.utc(),
    }: {
        from: StationId
        to: StationId
        viewer?: ViewerContext
        now?: DateTime
    }): Promise<RoutePlan> {
        const graph = await this.transitNetworkDataService.getGraph()

        let edges: RouteEdge[]
        try {
            edges = findRoute(graph, from, to, this.routing)
        } catch (error) {
            if (error instanceof StationNotFoundError) {
                throw new AppError({
                    message: 'Station not found',
                    statusCode: 404,
                    internalCode: 'STATION_NOT_FOUND',
                    description: error.stationId,
                })
            }
            if (error instanceof NoPathFoundError) {
                throw new AppError({
                    message: 'No path found between stations',
                    statusCode: 422,
                    internalCode: 'NO_PATH_FOUND',
                    description: `${from}->${to}`,
                })
            }
            throw error
        }

        const [segmentCollection, lines, stations] = await Promise.all([
            this.transitNetworkDataService.getSegments(),
            this.transitNetworkDataService.getLines(),
            this.transitNetworkDataService.getStations(),
        ])

        /*
         * Segments are seeded once per line variant, in the station order of that variant,
         * so a hop ridden the other way round has no row of its own — both orientations
         * have to resolve to the same segment.
         */
        const segmentByEdge = new Map<string, number>()
        for (const feature of segmentCollection.features) {
            const { id, line, from: segmentFrom, to: segmentTo } = feature.properties
            segmentByEdge.set(segmentKey(line, segmentFrom, segmentTo), id)
            segmentByEdge.set(segmentKey(line, segmentTo, segmentFrom), id)
        }

        const resolved: ResolvedEdge[] = edges.map((edge) => ({
            edge,
            segmentId: segmentByEdge.get(segmentKey(edge.lineId, edge.fromStationId, edge.toStationId)) ?? null,
        }))

        /*
         * The same one-hour window the map draws markers for. Only the weighting looks
         * ahead: a report that would be 80 minutes old on arrival is damped by the model
         * rather than dropped, which avoids a cliff at the window edge.
         */
        const liveReports = await this.reportsService.getLiveReports({
            from: now.minus({ hours: 1 }),
            to: now,
            currentTime: now,
            viewer,
        })

        const reports: RiskModelReport[] = liveReports.flatMap((report) => {
            const reportLines = report.lineId !== null ? [report.lineId] : stations[report.stationId].lines
            if (reportLines.length === 0) return []
            return [
                {
                    stationId: report.stationId,
                    lines: reportLines,
                    directionId: report.directionId,
                    timestamp: report.timestamp,
                },
            ]
        })

        const modelSegments: RiskModelSegment[] = segmentCollection.features.map((feature) => ({
            sid: String(feature.properties.id),
            lineId: feature.properties.line,
            fromStationId: feature.properties.from,
            toStationId: feature.properties.to,
        }))

        const circularLineIds = new Set(lines.filter((line) => line.isCircular).map((line) => line.id))

        try {
            const risks = predictRouteRisk(
                modelSegments,
                reports,
                resolved
                    .filter((entry): entry is ResolvedEdge & { segmentId: number } => entry.segmentId !== null)
                    .map((entry) => ({
                        sid: String(entry.segmentId),
                        at: now.plus({ seconds: entry.edge.offsetSeconds }).toJSDate(),
                    })),
                circularLineIds
            )

            const linesById = new Map(lines.map((line) => [line.id, line]))
            return summarize(groupIntoLegs(resolved, risks, linesById), resolved)
        } catch (error) {
            throw new AppError({
                message: 'Risk model failed',
                statusCode: 500,
                internalCode: 'RISK_MODEL_FAILED',
                description: error instanceof Error ? error.message : String(error),
            })
        }
    }
}
