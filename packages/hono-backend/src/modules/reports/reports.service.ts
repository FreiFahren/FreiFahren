import { DbConnection, reports } from "../../db";

class ReportsService {
  constructor(private db: DbConnection) {}

  async getReports() {
    const result = await this.db
      .select({
        timestamp: reports.timestamp,
        stationId: reports.station_id,
        directionId: reports.direction_id,
        lineId: reports.line_id,
      })
      .from(reports);

    return result;
  }
}
