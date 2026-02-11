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

    it('creates feedback and returns 201', async () => {
        const response = await sendFeedbackRequest({ feedback: 'Great app!' })

        expect(response.status).toBe(201)

        const body = (await response.json()) as {
            id: number
            feedback: string
            userAgent: string | null
            timestamp: string
        }

        expect(body.feedback).toBe('Great app!')
        expect(typeof body.id).toBe('number')
        expect(body.timestamp).toBeTruthy()
    })

    it('stores the user agent from the request', async () => {
        const response = await sendFeedbackRequest({ feedback: 'Test feedback' }, { 'User-Agent': 'TestAgent/1.0' })

        expect(response.status).toBe(201)

        const body = (await response.json()) as { id: number; userAgent: string | null }

        expect(body.userAgent).toBe('TestAgent/1.0')
    })

    it('stores null user agent when header is missing', async () => {
        const response = await app.request('/v0/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feedback: 'No UA' }),
        })

        expect(response.status).toBe(201)

        const body = (await response.json()) as { userAgent: string | null }

        expect(body.userAgent).toBeNull()
    })

    it('persists feedback in the database', async () => {
        await sendFeedbackRequest({ feedback: 'Persisted feedback' })

        const rows = await db.select().from(feedback)

        expect(rows.length).toBe(1)
        expect(rows[0].feedback).toBe('Persisted feedback')
    })

    it('rejects request with missing feedback field', async () => {
        const response = await sendFeedbackRequest({})

        expect(response.status).toBe(400)
    })
})
