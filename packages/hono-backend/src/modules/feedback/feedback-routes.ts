import { defineRoute } from '../../common/router'
import { Env } from '../../app-env'
import { insertFeedbackSchema } from '../../db'

export const postFeedback = defineRoute<Env>()({
    method: 'post',
    path: 'v0/feedback',
    schemas: {
        json: insertFeedbackSchema
            .pick({
                feedback: true,
                email: true,
            })
            .extend({
                feedback: insertFeedbackSchema.shape.feedback.trim().min(1),
            }),
    },
    handler: async (c) => {
        const feedbackService = c.get('feedbackService')

        const body = c.req.valid('json')

        await feedbackService.createFeedback(body)

        return c.json({ success: true })
    },
})
