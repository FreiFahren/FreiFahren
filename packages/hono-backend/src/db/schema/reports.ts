import { pgTable, serial, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

import { lines } from './lines';
import { stations } from './stations';

export const sourceEnum = pgEnum('source', ['mini_app', 'web_app', 'mobile_app', 'telegram']);

export const reports = pgTable('reports', {
  report_id: serial('report_id').primaryKey(),
  station_id: integer('station_id').notNull().references(() => stations.station_id),
  line_id: integer('line_id').references(() => lines.line_id),
  direction_id: integer('line_id').references(() => lines.line_id),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  source_id: sourceEnum('source_id').notNull(),
});

export const insertReportSchema = createInsertSchema(reports).pick({
  station_id: true,
  line_id: true,
});
