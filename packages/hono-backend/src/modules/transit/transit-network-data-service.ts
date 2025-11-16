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

    async getDistance(from: StationId, to: StationId): Promise<number> {
        if (from === to) {
            return 0
        }

        const fromStation = await this.db.select().from(stations).where(eq(stations.id, from)).limit(1)
        const toStation = await this.db.select().from(stations).where(eq(stations.id, to)).limit(1)

        if (fromStation.length === 0 || toStation.length === 0) {
            throw new Error('Station not found')
        }

        return 0
    }
}
