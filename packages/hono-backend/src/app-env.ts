import { Hono } from 'hono';

import { LinesService } from './modules/lines/lines-service';
import { ReportsService } from './modules/reports'
import { StationsService } from './modules/stations';

export type Services = {
  reportsService: ReportsService;
  stationsService: StationsService;
  linesService: LinesService;
}

export type Env = {
  Variables: Services;
}

export const registerServices = (app: Hono<Env>, services: Services) => {
  app.use('*', async (c, next) => {
    (Object.keys(services) as (keyof Services)[]).forEach((k) => {
      c.set(k, services[k]);
    })
    await next();
  });
}
