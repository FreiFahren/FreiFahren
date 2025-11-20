import { asc, eq } from 'drizzle-orm'

import { DbConnection, stations, lineStations, lines } from '../../db'

import type { Lines, Stations } from './types'

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

    async getLines(): Promise<Lines> {
        const joinedRows = await this.db
            .select({
                lineId: lines.id,
                stationId: lineStations.stationId,
            })
            .from(lines)
            .leftJoin(lineStations, eq(lineStations.lineId, lines.id))
            .orderBy(asc(lines.id), asc(lineStations.order))

        const result = joinedRows.reduce<Lines>((linesById, row) => {
            const base = Object.prototype.hasOwnProperty.call(linesById, row.lineId) ? linesById[row.lineId] : []
            const stations = row.stationId !== null ? [...base, row.stationId] : base
            linesById[row.lineId] = stations
            return linesById
        }, {} as Lines)

        return result
    }
}
