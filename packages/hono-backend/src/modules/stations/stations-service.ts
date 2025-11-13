import { eq } from 'drizzle-orm'

import { DbConnection, lines, lineStations } from '../../db'

export class StationsService {
    constructor(private db: DbConnection) {}

    async getLinesForStation(stationId: string) {
        const result = await this.db
            .select({
                id: lines.id,
                name: lines.name,
                isCircular: lines.isCircular,
            })
            .from(lineStations)
            .innerJoin(lines, eq(lineStations.lineId, lines.id))
            .where(eq(lineStations.stationId, stationId))

        return result
    }
}
