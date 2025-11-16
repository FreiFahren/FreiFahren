import { asc, eq, InferSelectModel } from 'drizzle-orm'

import { DbConnection, stations, lineStations, lines } from '../../db'
import { buildGraph, findPathWithAStar, type Graph } from './pathfinding'

type StationRow = InferSelectModel<typeof stations>
type LineRow = InferSelectModel<typeof lines>

type StationId = StationRow['id']
type LineId = LineRow['id']

type Station = {
    name: StationRow['name']
    coordinates: { latitude: StationRow['lat']; longitude: StationRow['lng'] }
    lines: LineId[]
}

type Stations = Record<StationId, Station>

type PathCacheKey = `${StationId}:${StationId}`

export class TransitNetworkDataService {
    private graphCache: Graph | null = null
    private pathCache = new Map<PathCacheKey, number>()
    private readonly MAX_CACHE_SIZE = 1000

    constructor(private db: DbConnection) {}

    private async buildGraph(): Promise<Graph> {
        if (this.graphCache) {
            return this.graphCache
        }

        const allStations = await this.db.select().from(stations)
        const allLineStations = await this.db
            .select()
            .from(lineStations)
            .orderBy(asc(lineStations.lineId), asc(lineStations.order))
        const allLines = await this.db.select().from(lines)

        this.graphCache = buildGraph(allStations, allLines, allLineStations)

        return this.graphCache
    }

    async getStations(): Promise<Stations> {
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

        const result = joinedRows.reduce<Stations>((stationsById, row) => {
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

        return result
    }

    async getDistance(from: StationId, to: StationId): Promise<number> {
        if (from === to) {
            return 0
        }

        const cacheKey: PathCacheKey = `${from}:${to}`
        const cached = this.pathCache.get(cacheKey)
        if (cached !== undefined) {
            return cached
        }

        const graph = await this.buildGraph()

        if (!graph.stations.has(from)) {
            throw new Error(`Station not found: ${from}`)
        }
        if (!graph.stations.has(to)) {
            throw new Error(`Station not found: ${to}`)
        }

        const distance = findPathWithAStar(graph, from, to)

        if (this.pathCache.size >= this.MAX_CACHE_SIZE) {
            const firstKey = this.pathCache.keys().next().value
            if (firstKey !== undefined) {
                this.pathCache.delete(firstKey)
            }
        }
        this.pathCache.set(cacheKey, distance)

        return distance
    }
}
