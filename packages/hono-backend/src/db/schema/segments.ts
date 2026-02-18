import { jsonb, pgTable, serial, varchar } from 'drizzle-orm/pg-core'

import { lines } from './lines'
import { stations } from './stations'

export const segments = pgTable('segments', {
    id: serial().primaryKey(),
    lineId: varchar({ length: 16 })
        .notNull()
        .references(() => lines.id, { onDelete: 'cascade' }),
    fromStationId: varchar({ length: 16 })
        .notNull()
        .references(() => stations.id, { onDelete: 'cascade' }),
    toStationId: varchar({ length: 16 })
        .notNull()
        .references(() => stations.id, { onDelete: 'cascade' }),
    color: varchar({ length: 7 }).notNull(),
    coordinates: jsonb().notNull().$type<[number, number][]>(),
})
