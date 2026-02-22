import { asc, eq } from 'drizzle-orm'

import { DbConnection, stations, lineStations, lines, segments } from '../../db'

import type { Lines, SegmentsFeatureCollection, Stations } from './types'

export class TransitNetworkDataService {
    private stationsCache: Promise<Stations> | null = null
    private linesCache: Promise<Lines> | null = null
    private segmentsCache: Promise<SegmentsFeatureCollection> | null = null

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
                        stationId: lineStations.stationId,
                    })
                    .from(lines)
                    .leftJoin(lineStations, eq(lineStations.lineId, lines.id))
                    .orderBy(asc(lines.id), asc(lineStations.order))

                return joinedRows.reduce<Lines>((linesById, row) => {
                    const base = Object.prototype.hasOwnProperty.call(linesById, row.lineId)
                        ? linesById[row.lineId]
                        : []
                    const stations = row.stationId !== null ? [...base, row.stationId] : base
                    linesById[row.lineId] = stations
                    return linesById
                }, {} as Lines)
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
}
