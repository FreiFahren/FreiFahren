import { Hono } from 'hono'

import { registerServices, type Env } from './app-env';
import { registerRoutes } from './common/router';
import { db } from './db';
import { getReports, ReportsService } from './modules/reports/';

const app = new Hono<Env>()

registerServices(app, {
  reportsService: new ReportsService(db),
});

const test = 'Does lint trigger?'

registerRoutes(app, [getReports]);

export default app
