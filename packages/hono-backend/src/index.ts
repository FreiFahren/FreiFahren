import { Hono } from 'hono'

import { registerServices, Services, type Env } from './app-env';
import { registerRoutes } from './common/router';
import { db, DbConnection } from './db';
import { LinesService } from './modules/lines/lines-service';
import { getReports, postReport, ReportsService } from './modules/reports/';
import { StationsService } from './modules/stations';

const app = new Hono<Env>()

const createServices = (db: DbConnection) => {
  const linesService = new LinesService(db);
  const stationsService = new StationsService(db);
  const reportsService = new ReportsService(db, stationsService, linesService);

  return { stationsService, linesService, reportsService } satisfies Services;
}

registerServices(app, createServices(db));

registerRoutes(app, [
  getReports,
  postReport
]);

export default app
