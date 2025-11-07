import { and, eq, sql } from "drizzle-orm";

import { DbConnection, lines, lineStations } from "../../db";

export class LinesService {
  constructor(private db: DbConnection) {}

  async isStationOnLine(stationId: string, lineId: string) {
    const result = await this.db
      .select({
        exists: sql<number>`1`,
      })
      .from(lineStations)
      .where(
        and(
          eq(lineStations.stationId, stationId),
          eq(lineStations.lineId, lineId)
        )
      );

    return result.length > 0;
  }

  async isLineCircular(lineId: string) {
    const result = await this.db
      .select({ isCircular: lines.isCircular })
      .from(lines)
      .where(eq(lines.id, lineId));

    return result[0]?.isCircular ?? false;
  }

  async isValidDirectionForLine(lineId: string, directionId: string) {
    if (await this.isLineCircular(lineId)) {
      return false;
    }

    const stations = await this.db
      .select({
        stationId: lineStations.stationId,
        order: lineStations.order,
      })
      .from(lineStations)
      .where(eq(lineStations.lineId, lineId))
      .orderBy(lineStations.order);

    if (stations.length === 0) {
      return false;
    }

    const firstStation = stations[0].stationId;
    const lastStation = stations[stations.length - 1].stationId;

    return directionId === firstStation || directionId === lastStation;
  }
}

