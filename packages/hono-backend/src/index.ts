import { Hono } from 'hono'
import { registerServices, type Env } from './app-env';
import { registerRoutes } from './common/router';
import { getReports, ReportsService } from './modules/reports/';
import { db } from './db';

const app = new Hono<Env>()

registerServices(app, {
  reportsService: new ReportsService(db),
});

registerRoutes(app, [getReports]);

export default app
