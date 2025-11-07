import { doublePrecision, pgTable, varchar } from 'drizzle-orm/pg-core';

export const stations = pgTable('stations', {
  id: varchar({ length: 16 }).primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  lat: doublePrecision().notNull(),
  lng: doublePrecision().notNull(),
});
