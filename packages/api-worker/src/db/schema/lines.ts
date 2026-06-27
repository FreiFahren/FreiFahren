import { boolean, integer, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core'

import type { RouteType } from '../seed/config'

import { stations } from './stations'

export const lines = pgTable('lines', {
    id: varchar({ length: 16 }).primaryKey(),
    name: varchar({ length: 255 }).notNull(),
    type: varchar({ length: 32 }).$type<RouteType>().notNull(),
    isCircular: boolean().notNull().default(false),
    color: varchar({ length: 7 }).notNull().default('#000000'),
})

export const lineStations = pgTable(
    'line_stations',
    {
        lineId: varchar({ length: 16 })
            .notNull()
            .references(() => lines.id, { onDelete: 'cascade' }),
        stationId: varchar({ length: 16 })
            .notNull()
            .references(() => stations.id, { onDelete: 'cascade' }),
        order: integer().notNull(),
    },
    (table) => [primaryKey({ columns: [table.lineId, table.stationId] })]
)
