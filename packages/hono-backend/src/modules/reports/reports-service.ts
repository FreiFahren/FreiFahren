import { DbConnection, reports } from "../../db/";

export class ReportsService {
  constructor(private db: DbConnection) {}

  async getReports() {
    const result = await this.db
      .select({
        timestamp: reports.timestamp,
        stationId: reports.stationId,
        directionId: reports.directionId,
        lineId: reports.stationId,
      })
      .from(reports);

    return result;
  }
}
