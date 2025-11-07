import { integer, pgTable, varchar } from 'drizzle-orm/pg-core';

import { stations } from './stations';

export const lines = pgTable('lines', {
  id: varchar({ length: 16 }).primaryKey(),
  name: varchar({ length: 255 }).notNull(),
});

export const stationLines = pgTable('station_lines', {
  stationId: varchar({ length: 16 }).notNull().references(() => stations.id, { onDelete: 'cascade' }),
  lineId: varchar({ length: 16 }).notNull().references(() => lines.id, { onDelete: 'cascade' }),
  order: integer().notNull(),
});
