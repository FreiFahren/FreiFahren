import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { lines } from './lines'
import { stations } from './stations'

export const segments = sqliteTable(
    'segments',
    {
        id: integer().primaryKey({ autoIncrement: true }),
        lineId: text({ length: 16 })
            .notNull()
            .references(() => lines.id, { onDelete: 'cascade' }),
        fromStationId: text({ length: 16 })
            .notNull()
            .references(() => stations.id, { onDelete: 'cascade' }),
        toStationId: text({ length: 16 })
            .notNull()
            .references(() => stations.id, { onDelete: 'cascade' }),
        position: integer().notNull(),
        color: text({ length: 7 }).notNull(),
        coordinates: text({ mode: 'json' }).notNull().$type<[number, number][]>(),
    },
    (table) => [uniqueIndex('segments_line_from_to_idx').on(table.lineId, table.fromStationId, table.toStationId)]
)
