import { createInsertSchema } from 'drizzle-zod'
import { pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { z } from 'zod'

export const feedback = pgTable('feedback', {
    feedbackId: serial().primaryKey(),
    email: varchar({ length: 255 }),
    feedback: text().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
})

export const insertFeedbackSchema = createInsertSchema(feedback).pick({
    email: true,
    feedback: true,
})

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>
