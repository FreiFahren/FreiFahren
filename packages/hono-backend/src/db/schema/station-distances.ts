import { integer, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core'

import { stations } from './stations'

export const stationDistances = pgTable(
    'station_distances',
    {
        fromStationId: varchar({ length: 16 })
            .notNull()
            .references(() => stations.id, { onDelete: 'cascade' }),
        toStationId: varchar({ length: 16 })
            .notNull()
            .references(() => stations.id, { onDelete: 'cascade' }),
        distance: integer().notNull(),
    },
    (table) => [primaryKey({ columns: [table.fromStationId, table.toStationId] })]
)
