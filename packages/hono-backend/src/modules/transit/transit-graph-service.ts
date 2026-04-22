import { asc } from 'drizzle-orm'

import { AppError } from '../../common/errors'
import { DbConnection, stations, lineStations, lines } from '../../db'
import { buildGraph, StationId, type Graph } from './pathfinding'
import { TransitPathCacheService } from './transit-path-cache-service'

export class TransitGraphService {
    private graphCache: Graph | null = null
    private pathCacheService = new TransitPathCacheService()
    private graphPromise: Promise<Graph> | null = null

    constructor(private db: DbConnection) {}

    async getGraph(): Promise<Graph> {
        if (this.graphCache) {
            return this.graphCache
        }

        if (this.graphPromise) {
            return this.graphPromise
        }

        this.graphPromise = this._loadGraph()
        const graph = await this.graphPromise
        this.graphCache = graph
        return graph
    }

    private async _loadGraph(): Promise<Graph> {
        const allStations = await this.db.select().from(stations)
        const allLineStations = await this.db
            .select()
            .from(lineStations)
            .orderBy(asc(lineStations.lineId), asc(lineStations.order))
        const allLines = await this.db.select().from(lines)

        const graph = buildGraph(allStations, allLines, allLineStations)

        if (this.pathCacheService.size() === 0) {
            const loaded = await this.pathCacheService.loadFromDisk(graph.stations.size)
            if (!loaded) {
                this.pathCacheService.precomputeAllPaths(graph).catch((error) => {
                    console.error('error during path pre-computation:', error)
                })
            }
        }

        return graph
    }

    async getDistance(from: StationId, to: StationId): Promise<number> {
        if (from === to) {
            return 0
        }

        const graph = await this.getGraph()

        if (!graph.stations.has(from)) {
            throw new AppError({
                message: 'Station not found',
                statusCode: 404,
                internalCode: 'STATION_NOT_FOUND',
                description: `from=${from}`,
            })
        }
        if (!graph.stations.has(to)) {
            throw new AppError({
                message: 'Station not found',
                statusCode: 404,
                internalCode: 'STATION_NOT_FOUND',
                description: `to=${to}`,
            })
        }

        try {
            return this.pathCacheService.getOrCompute(graph, from, to)
        } catch (error) {
            if (error instanceof Error && error.message.includes('No path found')) {
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
}

