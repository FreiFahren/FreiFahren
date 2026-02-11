import { beforeAll, beforeEach, describe, expect, it } from 'bun:test'

import { db, feedback } from '../src/db'

let app: (typeof import('../src/index'))['default']

const sendFeedbackRequest = (payload: object, headers?: Record<string, string>) => {
    return app.request('/v0/feedback', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: JSON.stringify(payload),
    })
}

describe('Feedback endpoint', () => {
    beforeAll(async () => {
        const mod = await import('../src/index')
        app = mod.default
    })

    beforeEach(async () => {
        await db.delete(feedback)
    })

    it('returns 201 with no body', async () => {
        const response = await sendFeedbackRequest({ feedback: 'Great app!' })

        expect(response.status).toBe(201)

        const body = await response.text()
        expect(body).toBe('')
    })

    it('persists feedback and user agent in the database', async () => {
        await sendFeedbackRequest({ feedback: 'Persisted feedback' }, { 'User-Agent': 'TestAgent/1.0' })

        const rows = await db.select().from(feedback)

        expect(rows.length).toBe(1)
        expect(rows[0].feedback).toBe('Persisted feedback')
        expect(rows[0].userAgent).toBe('TestAgent/1.0')
    })

    it('stores null user agent when header is missing', async () => {
        await sendFeedbackRequest({ feedback: 'No UA' })

        const [row] = await db.select().from(feedback)

        expect(row.userAgent).toBeNull()
    })

    it('rejects request with missing feedback field', async () => {
        const response = await sendFeedbackRequest({})

        expect(response.status).toBe(400)
    })
})
