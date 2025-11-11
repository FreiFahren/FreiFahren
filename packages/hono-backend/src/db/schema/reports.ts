import {
  pgTable,
  varchar,
  serial,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { lines } from "./lines";
import { stations } from "./stations";

export const sourceEnum = pgEnum("source", [
  "mini_app",
  "web_app",
  "mobile_app",
  "telegram",
]);

export const reports = pgTable("reports", {
  reportId: serial().primaryKey(),
  stationId: varchar({ length: 16 })
    .notNull()
    .references(() => stations.id),
  lineId: varchar({ length: 16 }).references(() => lines.id),
  directionId: varchar({ length: 16 }).references(() => lines.id),
  timestamp: timestamp().notNull().defaultNow(),
  source: sourceEnum().notNull(),
});

export const insertReportSchema = createInsertSchema(reports).pick({
  stationId: true,
  lineId: true,
});
