import { asc, eq } from 'drizzle-orm'

import { AppError, NoPathFoundError } from '../../common/errors'
import { DbConnection, stations, lineStations, lines, segments } from '../../db'

import { buildGraph, type Graph, type StationId } from './pathfinding'
import { TransitPathCacheService } from './transit-path-cache-service'
import type { Line, Lines, SegmentsFeatureCollection, Stations } from './types'

export class TransitNetworkDataService {
    private stationsCache: Promise<Stations> | null = null
    private linesCache: Promise<Lines> | null = null
    private segmentsCache: Promise<SegmentsFeatureCollection> | null = null
    private graphCache: Graph | null = null
    private graphPromise: Promise<Graph> | null = null
    private pathCacheService = new TransitPathCacheService()

    constructor(private db: DbConnection) {}

    async getStations(): Promise<Stations> {
        if (this.stationsCache) {
            return this.stationsCache
        }

        const stationsPromise = (async () => {
            try {
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
                    const lines = row.lineId !== null ? [...base.lines, row.lineId] : base.lines
                    stationsById[row.id] = { ...base, lines }
                    return stationsById
                }, {} as Stations)
            } catch (error) {
                this.stationsCache = null
                throw error
            }
        })()

        this.stationsCache = stationsPromise
        return stationsPromise
    }

    async getLines(): Promise<Lines> {
        if (this.linesCache) {
            return this.linesCache
        }

        const linesPromise = (async () => {
            try {
                const joinedRows = await this.db
                    .select({
                        lineId: lines.id,
                        lineName: lines.name,
                        lineType: lines.type,
                        lineIsCircular: lines.isCircular,
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
                            stations: [],
                        }
                        byId.set(row.lineId, line)
                    }
                    if (row.stationId !== null) {
                        line.stations.push(row.stationId)
                    }
                }
                return Array.from(byId.values())
            } catch (error) {
                this.linesCache = null
                throw error
            }
        })()

        this.linesCache = linesPromise
        return linesPromise
    }

    async getSegments(): Promise<SegmentsFeatureCollection> {
        if (this.segmentsCache) {
            return this.segmentsCache
        }

        const segmentsPromise = (async () => {
            try {
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
            } catch (error) {
                this.segmentsCache = null
                throw error
            }
        })()

        this.segmentsCache = segmentsPromise
        return segmentsPromise
    }

    async getDistance(from: StationId, to: StationId): Promise<number> {
        const graph = await this.getGraph()

        this.assertStationExists(graph, from, 'from')
        this.assertStationExists(graph, to, 'to')

        if (from === to) {
            return 0
        }

        try {
            return this.pathCacheService.getOrCompute(graph, from, to)
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

    private async getGraph(): Promise<Graph> {
        if (this.graphCache) {
            return this.graphCache
        }

        if (this.graphPromise) {
            return this.graphPromise
        }

        // Share the same in-flight graph load across concurrent requests.
        // If loading fails, clear the promise so the next request can retry.
        this.graphPromise = this.loadGraph()
        try {
            const graph = await this.graphPromise
            this.graphCache = graph
            return graph
        } catch (error) {
            this.graphPromise = null
            throw error
        }
    }

    private async loadGraph(): Promise<Graph> {
        const allStations = await this.db.select().from(stations)
        const allLineStations = await this.db
            .select()
            .from(lineStations)
            .orderBy(asc(lineStations.lineId), asc(lineStations.order))
        const allLines = await this.db.select().from(lines)

        return buildGraph(allStations, allLines, allLineStations)
    }
}
