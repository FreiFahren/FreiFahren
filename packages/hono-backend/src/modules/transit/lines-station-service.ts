import { DbConnection, stations, stationLines } from '../../db'

// Todo:
// -  Add a cache to the service so that it requests the database once
// - Perform operations on the database in a single transaction
// - Add proper types

export class LinesStationService {
    constructor(private db: DbConnection) {}

    async getStations() {
        const allStations = await this.db.select().from(stations)
        const allStationLines = await this.db.select().from(stationLines)

        const lineIdsByStationId = new Map<string, string[]>()
        for (const stationLine of allStationLines) {
            const existing = lineIdsByStationId.get(stationLine.stationId) ?? []
            existing.push(stationLine.lineId)
            lineIdsByStationId.set(stationLine.stationId, existing)
        }

        const result: Record<
            string,
            { name: string; coordinates: { latitude: number; longitude: number }; lines: string[] }
        > = {}

        for (const station of allStations) {
            result[station.id] = {
                name: station.name,
                coordinates: {
                    latitude: station.lat,
                    longitude: station.lng,
                },
                lines: lineIdsByStationId.get(station.id) ?? [],
            }
        }

        return result
    }
}
