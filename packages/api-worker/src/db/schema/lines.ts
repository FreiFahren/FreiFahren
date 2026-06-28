import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import type { RouteType } from '../seed/config'

import { stations } from './stations'

export const lines = sqliteTable('lines', {
    id: text({ length: 16 }).primaryKey(),
    name: text({ length: 255 }).notNull(),
    type: text({ length: 32 }).$type<RouteType>().notNull(),
    isCircular: integer({ mode: 'boolean' }).notNull().default(false),
    color: text({ length: 7 }).notNull().default('#000000'),
})

export const lineStations = sqliteTable(
    'line_stations',
    {
        lineId: text({ length: 16 })
            .notNull()
            .references(() => lines.id, { onDelete: 'cascade' }),
        stationId: text({ length: 16 })
            .notNull()
            .references(() => stations.id, { onDelete: 'cascade' }),
        order: integer().notNull(),
    },
    (table) => [primaryKey({ columns: [table.lineId, table.stationId] })]
)
