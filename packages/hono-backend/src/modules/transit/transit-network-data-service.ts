import { and, asc, eq } from 'drizzle-orm'

import { AppError } from '../../common/errors'
import { DbConnection, stations, lineStations, lines, segments, stationDistances } from '../../db'

import type { Line, Lines, SegmentsFeatureCollection, Stations, StationId } from './types'

export class TransitNetworkDataService {
    constructor(private db: DbConnection) {}

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

    async getLines(): Promise<Lines> {
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

    async getSegments(): Promise<SegmentsFeatureCollection> {
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
        if (from === to) {
            await this.assertStationExists(from, 'from')
            return 0
        }

        await this.assertStationExists(from, 'from')
        await this.assertStationExists(to, 'to')

        const rows = await this.db
            .select({ distance: stationDistances.distance })
            .from(stationDistances)
            .where(and(eq(stationDistances.fromStationId, from), eq(stationDistances.toStationId, to)))
            .limit(1)

        if (rows.length === 0) {
            throw new AppError({
                message: 'No path found between stations',
                statusCode: 422,
                internalCode: 'NO_PATH_FOUND',
                description: `${from}->${to}`,
            })
        }

        return rows[0].distance
    }

    private async assertStationExists(stationId: StationId, field: 'from' | 'to'): Promise<void> {
        const rows = await this.db.select({ id: stations.id }).from(stations).where(eq(stations.id, stationId)).limit(1)

        if (rows.length === 0) {
            throw new AppError({
                message: 'Station not found',
                statusCode: 404,
                internalCode: 'STATION_NOT_FOUND',
                description: `${field}=${stationId}`,
            })
        }
    }
}
