import { eq, InferSelectModel } from 'drizzle-orm'

import { DbConnection, stations, stationLines, lines } from '../../db'

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

export class TransitNetworkDataService {
    constructor(private db: DbConnection) {}

    async getStations(): Promise<Stations> {
        const joinedRows = await this.db
            .select({
                id: stations.id,
                name: stations.name,
                lat: stations.lat,
                lng: stations.lng,
                lineId: stationLines.lineId,
            })
            .from(stations)
            .leftJoin(stationLines, eq(stationLines.stationId, stations.id))

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
