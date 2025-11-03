import { pgTable, serial } from 'drizzle-orm/pg-core';

export const stations = pgTable('stations', {
  station_id: serial('station_id').primaryKey(),
  // Additional fields will be defined here
});
