import { boolean, integer, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core';

import { stations } from './stations';

export const lines = pgTable('lines', {
  id: varchar({ length: 16 }).primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  isCircular: boolean().notNull().default(false),
});

export const lineStations = pgTable('line_stations', {
  lineId: varchar({ length: 16 }).notNull().references(() => lines.id, { onDelete: 'cascade' }),
  stationId: varchar({ length: 16 }).notNull().references(() => stations.id, { onDelete: 'cascade' }),
  order: integer().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.lineId, table.stationId] }),
}));
