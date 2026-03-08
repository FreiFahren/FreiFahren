import { Env } from '../../app-env'
import { defineRoute } from '../../common/router'
import { db, feedback, insertFeedbackSchema } from '../../db'

export const postFeedback = defineRoute<Env>()({
    method: 'post',
    path: 'v0/feedback',
    schemas: {
        json: insertFeedbackSchema,
    },
    handler: async (c) => {
        const { feedback: feedbackText } = c.req.valid('json')
        const userAgent = c.req.header('user-agent') ?? null

        await db.insert(feedback).values({ feedback: feedbackText, userAgent })

        return c.body(null, 201)
    },
})
