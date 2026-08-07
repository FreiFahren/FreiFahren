import { afterEach, describe, expect, it } from 'vitest'

import { db, stations } from './test-db'
import { appRequestWithRedirect, resetTestEnv, sendReportRequest, setTestEnv, testEnv } from './test-utils'

describe('POST /v0/reports killswitch', () => {
    afterEach(() => {
        resetTestEnv()
    })

    it('allows unauthenticated requests while REPORTS_DISABLED is false', async () => {
        setTestEnv({ REPORTS_DISABLED: 'false' })
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)

        const response = await appRequestWithRedirect('/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stationId: station.id, source: 'web_app' }),
        })

        expect(response.status).toBe(200)
    })

    it('rejects unauthenticated requests with 503 while REPORTS_DISABLED is true', async () => {
        setTestEnv({ REPORTS_DISABLED: 'true' })
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)

        const response = await appRequestWithRedirect('/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stationId: station.id, source: 'web_app' }),
        })

        expect(response.status).toBe(503)

        const body = (await response.json()) as { details: { internal_code: string } }
        expect(body.details.internal_code).toBe('REPORTING_DISABLED')
    })

    it('still allows authenticated telegram-worker relays through while disabled', async () => {
        setTestEnv({ REPORTS_DISABLED: 'true' })
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)

        const response = await sendReportRequest({ stationId: station.id, source: 'telegram' })

        expect(response.status).toBe(200)
    })

    it('rejects a request with the wrong password while disabled', async () => {
        setTestEnv({ REPORTS_DISABLED: 'true' })
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)

        const response = await appRequestWithRedirect('/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Password': `${testEnv().REPORT_PASSWORD}-wrong` },
            body: JSON.stringify({ stationId: station.id, source: 'web_app' }),
        })

        expect(response.status).toBe(503)
    })
})

describe('GET /v0/reports/status', () => {
    afterEach(() => {
        resetTestEnv()
    })

    it('reflects REPORTS_DISABLED=false', async () => {
        setTestEnv({ REPORTS_DISABLED: 'false' })

        const response = await appRequestWithRedirect('/reports/status')

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ disabled: false })
    })

    it('reflects REPORTS_DISABLED=true', async () => {
        setTestEnv({ REPORTS_DISABLED: 'true' })

        const response = await appRequestWithRedirect('/reports/status')

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ disabled: true })
    })
})
