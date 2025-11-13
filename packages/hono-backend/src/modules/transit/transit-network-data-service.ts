import { eq, InferSelectModel } from 'drizzle-orm'

import { DbConnection, stations, lineStations, lines } from '../../db'

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
}
