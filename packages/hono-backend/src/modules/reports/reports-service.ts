import { and, gte, lte } from "drizzle-orm";
import {isNil} from 'lodash'
import { DateTime } from "luxon";

import { DbConnection, InsertReport, reports } from "../../db/";
import { LinesService } from "../lines/lines-service";
import { StationsService } from "../stations/stations-service";

export class ReportsService {
  constructor(private db: DbConnection, private stationsService: StationsService, private linesService: LinesService) {}

  async getReports({ from, to }: { from: DateTime, to: DateTime }) {
    const result = await this.db
      .select({
        timestamp: reports.timestamp,
        stationId: reports.stationId,
        directionId: reports.directionId,
        lineId: reports.lineId,
      })
      .from(reports)
      .where(
        and(
        gte(reports.timestamp, from.toJSDate()),
            lte(reports.timestamp, to.toJSDate()
          )
        )
      );

    return result;
  }

  async createReport(reportData: InsertReport) {
    const postprocessed = await this.postprocessReport(reportData);

    const result = await this.db
      .insert(reports)
      .values(postprocessed)

    return result;
  }

  private async postprocessReport(reportData: InsertReport) {
    return [
      this.postprocessLineId.bind(this),
      this.postprocessDirectionId.bind(this),
    ].reduce(
        (acc, curr) => acc.then((val) => curr(val)),
        Promise.resolve(reportData),
     );
  }

  private async postprocessLineId(reportData: InsertReport): Promise<InsertReport> {
    if (isNil(reportData.lineId)) {
      const linesWithStation = await this.stationsService.getLinesForStation(reportData.stationId);

      return {
        ...reportData,
        lineId: linesWithStation.length === 1 ? linesWithStation[0].id : null,
      }
    }

    return {
      ...reportData,
      lineId:
        await this.linesService.isStationOnLine(reportData.stationId, reportData.lineId) 
          ? reportData.lineId
          : null
    }
  }

  private async postprocessDirectionId(reportData: InsertReport): Promise<InsertReport> {
    if (isNil(reportData.lineId) || isNil(reportData.directionId)) {
      return {
        ...reportData,
        directionId: null,
      }
    }

    if (await this.linesService.isLineCircular(reportData.lineId)) {
      return {
        ...reportData,
        directionId: null,
      }
    }

    return {
      ...reportData,
      directionId:
        await this.linesService.isValidDirectionForLine(reportData.lineId, reportData.directionId)
          ? reportData.directionId 
          : null
    }
  }

}
