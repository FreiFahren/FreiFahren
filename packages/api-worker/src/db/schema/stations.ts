import { real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const stations = sqliteTable('stations', {
    id: text({ length: 16 }).primaryKey(),
    name: text({ length: 255 }).notNull(),
    lat: real().notNull(),
    lng: real().notNull(),
})
