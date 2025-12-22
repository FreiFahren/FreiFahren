import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Hono } from 'hono'

import { db, reports, stations } from '../src/db'
import { seedBaseData } from '../src/db/seed/seed'
import { desc } from 'drizzle-orm'

let app: (typeof import('../src/index'))['default']
let fakeNlpServer: ReturnType<typeof Bun.serve> | null = null
let fakeSecurityServer: ReturnType<typeof Bun.serve> | null = null

type CapturedRequest = {
    body: unknown
    password: string | null
}

const capturedRequests: CapturedRequest[] = []
let securityValidResponse = true

describe('Telegram notification', () => {
    let shouldFail: boolean

    beforeAll(async () => {
        await seedBaseData(db)

        const fakeNlp = new Hono()

        fakeNlp.post('/report-inspector', async (c) => {
            const body = await c.req.json()
            const password = c.req.header('X-Password') ?? null

            capturedRequests.push({ body, password })

            if (shouldFail) {
                return c.json({ status: 'error' }, 500)
            }

            return c.json({ status: 'success' }, 200)
        })

        fakeNlpServer = Bun.serve({
            port: 0,
            fetch: fakeNlp.fetch,
        })

        const fakeSecurity = new Hono()
        fakeSecurity.post('/check', async (c) => {
            return c.json({ valid: securityValidResponse })
        })

        fakeSecurityServer = Bun.serve({
            port: 0,
            fetch: fakeSecurity.fetch,
        })

        process.env.NLP_SERVICE_URL = `http://127.0.0.1:${fakeNlpServer.port}`
        process.env.SECURITY_MICROSERVICE_URL = `http://127.0.0.1:${fakeSecurityServer.port}`
        process.env.REPORT_PASSWORD = 'test-password'
        process.env.NODE_ENV = 'production'

        const mod = await import('../src/index')
        app = mod.default
    })

    afterAll(() => {
        fakeNlpServer?.stop()
        fakeSecurityServer?.stop()
    })

    beforeEach(() => {
        capturedRequests.length = 0
        shouldFail = false
        securityValidResponse = true
    })

    it('sends a Telegram notification when source is not telegram and returns 200', async () => {
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)

        const response = await app.request('/v0/reports', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                stationId: station.id,
                source: 'web_app',
            }),
        })

        expect(response.status).toBe(200)
        expect(capturedRequests.length).toBe(1)
        expect(capturedRequests[0]?.password).toBe('test-password')

        const body = capturedRequests[0]?.body as {
            line: string | null
            station: string
            direction: string | null
            message: string | null
            stationId: string
        }

        expect(body.stationId).toBe(station.id)
        expect(typeof body.station).toBe('string')
    })

    it('returns 200 and a failure header when Telegram notification fails', async () => {
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)

        shouldFail = true

        const response = await app.request('/v0/reports', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                stationId: station.id,
                source: 'web_app',
            }),
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('X-Telegram-Notification-Status')).toBe('failed')

        // ensure we still attempted to call the NLP service
        expect(capturedRequests.length).toBe(1)
    })

    it('does not send a Telegram notification if database insertion fails', async () => {
        const response = await app.request('/v0/reports', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                stationId: 'invalid_id', // Triggers FK violation
                source: 'web_app',
            }),
        })

        expect(response.status).toBe(500)
        expect(capturedRequests.length).toBe(0)
    })
})

describe('Security Verification', () => {
    it('bypasses security check when the correct X-Password is provided', async () => {
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)
        securityValidResponse = false // Even if security would have blocked it

        const response = await app.request('/v0/reports', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Password': 'test-password',
            },
            body: JSON.stringify({
                stationId: station.id,
            }),
        })

        // Should succeed because password bypasses security service call
        expect(response.status).toBe(200)
    })
})

describe('Report API contract', () => {
    beforeAll(async () => {
        await seedBaseData(db)
        const mod = await import('../src/index')
        app = mod.default

        process.env.NODE_ENV = 'production'
        process.env.REPORT_PASSWORD = 'test-password' // To pass the security check
    })

    it('defaults to telegram source when source is missing in request', async () => {
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)

        const response = await app.request('/v0/reports', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Password': 'test-password',
            },
            body: JSON.stringify({
                stationId: station.id,
                // source is omitted
            }),
        })

        expect(response.status).toBe(200)

        const [report] = await db
            .select({ source: reports.source })
            .from(reports)
            .orderBy(desc(reports.timestamp))
            .limit(1)

        expect(report.source).toBe('telegram')
    })
})
