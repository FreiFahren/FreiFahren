import { pgTable, serial } from 'drizzle-orm/pg-core';

export const lines = pgTable('lines', {
  line_id: serial('line_id').primaryKey(),
  // Additional fields will be defined here
});
