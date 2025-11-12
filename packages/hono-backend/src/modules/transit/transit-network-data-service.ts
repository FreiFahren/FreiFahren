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

        const result = joinedRows.reduce<Stations>((acc, row) => {
            const existing = acc[row.id] ?? {
                name: row.name,
                coordinates: { latitude: row.lat, longitude: row.lng },
                lines: [],
            }
            const lines = row.lineId !== null ? [...existing.lines, row.lineId] : existing.lines
            acc[row.id] = { ...existing, lines }
            return acc
        }, {})

        return result
    }
}
