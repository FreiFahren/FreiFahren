import { eq } from 'drizzle-orm'

import { DbConnection, stations, stationLines } from '../../db'

type StationId = string
type LineId = string

type Stations = Record<StationId, Station>
type Station = {
    name: string
    coordinates: { latitude: number; longitude: number }
    lines: LineId[]
}

export class LinesStationService {
    constructor(private db: DbConnection) {}

    // Perform entire query in a single transaction to get maximum performance by serializing at DB level
    async getStations(): Promise<Stations> {
        const joinedRows = await this.db.transaction(async (tx) => {
            return tx
                .select({
                    id: stations.id,
                    name: stations.name,
                    lat: stations.lat,
                    lng: stations.lng,
                    lineId: stationLines.lineId,
                })
                .from(stations)
                .leftJoin(stationLines, eq(stationLines.stationId, stations.id))
        })

        const result: Stations = {}

        for (const row of joinedRows) {
            result[row.id] ??= {
                name: row.name,
                coordinates: { latitude: row.lat, longitude: row.lng },
                lines: [],
            }
            if (row.lineId !== null) {
                result[row.id]!.lines.push(row.lineId)
            }
        }

        return result
    }
}
