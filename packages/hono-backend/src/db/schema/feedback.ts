import { pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema } from 'drizzle-zod'

export const feedback = pgTable('feedback', {
    id: serial().primaryKey(),
    feedback: text().notNull(),
    userAgent: varchar({ length: 512 }),
    timestamp: timestamp().notNull().defaultNow(),
})

export const insertFeedbackSchema = createInsertSchema(feedback).pick({
    feedback: true,
})
