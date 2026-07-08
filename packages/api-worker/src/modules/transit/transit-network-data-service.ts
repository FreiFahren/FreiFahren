import { DEFAULT_CITY_SLUG } from '@freifahren/cities'
import { asc, eq } from 'drizzle-orm'

import { AppError, NoPathFoundError } from '../../common/errors'
import { DbConnection, stations, lineStations, lines, segments } from '../../db'

import { buildGraph, findPathWithAStar, type Graph, type StationId } from './pathfinding'
import { cachedReference, type CacheCtx } from './reference-cache'
import type { Line, Lines, SegmentsFeatureCollection, Stations } from './types'

// Raw table rows buildGraph consumes, cached as one JSON entry. All columns are
// Plain strings/numbers/booleans, so the rows round-trip through the cache intact;
// LineStations keeps its (lineId, order) ordering as a JSON array.
type GraphInputs = {
    stations: (typeof stations.$inferSelect)[]
    lines: (typeof lines.$inferSelect)[]
    lineStations: (typeof lineStations.$inferSelect)[]
}

export class TransitNetworkDataService {
    constructor(
        private db: DbConnection,
        // Scopes the reference-cache entries to this city so one city's data never
        // Serves another's. Defaults to Berlin for direct construction in tests.
        private citySlug: string = DEFAULT_CITY_SLUG,
        private cacheCtx: CacheCtx = undefined
    ) {}

    // Static reference data — read through the transit edge cache so the hot in-process
    // Callers (risk, reports) don't re-scan the full tables in D1 on every request.
    async getStations(): Promise<Stations> {
        return cachedReference(this.citySlug, 'stations', () => this.loadStations(), this.cacheCtx)
    }

    async getLines(): Promise<Lines> {
        return cachedReference(this.citySlug, 'lines', () => this.loadLines(), this.cacheCtx)
    }

    async getSegments(): Promise<SegmentsFeatureCollection> {
        return cachedReference(this.citySlug, 'segments', () => this.loadSegments(), this.cacheCtx)
    }

    private async loadStations(): Promise<Stations> {
        const joinedRows = await this.db
            .select({
                id: stations.id,
                name: stations.name,
                lat: stations.lat,
                lng: stations.lng,
                lineId: lineStations.lineId,
            })
            .from(stations)
            .leftJoin(lineStations, eq(lineStations.stationId, stations.id))

        return joinedRows.reduce<Stations>((stationsById, row) => {
            const base = Object.prototype.hasOwnProperty.call(stationsById, row.id)
                ? stationsById[row.id]
                : {
                      name: row.name,
                      coordinates: { latitude: row.lat, longitude: row.lng },
                      lines: [],
                  }
            const lineIds = row.lineId !== null ? [...base.lines, row.lineId] : base.lines
            stationsById[row.id] = { ...base, lines: lineIds }
            return stationsById
        }, {} as Stations)
    }

    private async loadLines(): Promise<Lines> {
        const joinedRows = await this.db
            .select({
                lineId: lines.id,
                lineName: lines.name,
                lineType: lines.type,
                lineIsCircular: lines.isCircular,
                lineColor: lines.color,
                stationId: lineStations.stationId,
            })
            .from(lines)
            .leftJoin(lineStations, eq(lineStations.lineId, lines.id))
            .orderBy(asc(lines.id), asc(lineStations.order))

        const byId = new Map<string, Line>()
        for (const row of joinedRows) {
            let line = byId.get(row.lineId)
            if (!line) {
                line = {
                    id: row.lineId,
                    name: row.lineName,
                    type: row.lineType,
                    isCircular: row.lineIsCircular,
                    color: row.lineColor,
                    stations: [],
                }
                byId.set(row.lineId, line)
            }
            if (row.stationId !== null) {
                line.stations.push(row.stationId)
            }
        }
        return Array.from(byId.values())
    }

    private async loadSegments(): Promise<SegmentsFeatureCollection> {
        const rows = await this.db
            .select({
                id: segments.id,
                line: segments.lineId,
                from: segments.fromStationId,
                to: segments.toStationId,
                color: segments.color,
                coordinates: segments.coordinates,
            })
            .from(segments)
            .orderBy(asc(segments.lineId), asc(segments.position))

        return {
            type: 'FeatureCollection' as const,
            features: rows.map((row) => ({
                type: 'Feature' as const,
                properties: {
                    id: row.id,
                    line: row.line,
                    from: row.from,
                    to: row.to,
                    color: row.color,
                },
                geometry: {
                    type: 'LineString' as const,
                    coordinates: row.coordinates,
                },
            })),
        }
    }

    async getDistance(from: StationId, to: StationId): Promise<number> {
        const graph = await this.loadGraph()

        this.assertStationExists(graph, from, 'from')
        this.assertStationExists(graph, to, 'to')

        if (from === to) {
            return 0
        }

        try {
            return findPathWithAStar(graph, from, to)
        } catch (error) {
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
    }

    private assertStationExists(graph: Graph, stationId: StationId, field: 'from' | 'to'): void {
        if (!graph.stations.has(stationId)) {
            throw new AppError({
                message: 'Station not found',
                statusCode: 404,
                internalCode: 'STATION_NOT_FOUND',
                description: `${field}=${stationId}`,
            })
        }
    }

    private async loadGraph(): Promise<Graph> {
        // Cache the raw rows rather than the built Graph — Graph holds Maps, which
        // Don't survive the JSON round-trip; rebuilding from rows is cheap in-process.
        const inputs = await cachedReference(this.citySlug, 'graph-inputs', () => this.loadGraphInputs(), this.cacheCtx)
        return buildGraph(inputs.stations, inputs.lines, inputs.lineStations)
    }

    private async loadGraphInputs(): Promise<GraphInputs> {
        // The three reads are independent, so issue them concurrently rather than as
        // Three back-to-back D1 round-trips (Sentry "consecutive DB queries").
        const [allStations, allLineStations, allLines] = await Promise.all([
            this.db.select().from(stations),
            this.db.select().from(lineStations).orderBy(asc(lineStations.lineId), asc(lineStations.order)),
            this.db.select().from(lines),
        ])

        return { stations: allStations, lines: allLines, lineStations: allLineStations }
    }
}
