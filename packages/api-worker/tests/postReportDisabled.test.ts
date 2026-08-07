import { describe, expect, it } from 'vitest'

import { db, stations } from './test-db'
import { appRequestWithRedirect, sendReportRequest, testEnv } from './test-utils'

describe('POST /v0/reports killswitch', () => {
    it('rejects unauthenticated requests with 503 while reporting is disabled', async () => {
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

    it('still allows authenticated telegram-worker relays through', async () => {
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)

        const response = await sendReportRequest({ stationId: station.id, source: 'telegram' })

        expect(response.status).toBe(200)
    })

    it('rejects a request with the wrong password', async () => {
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)

        const response = await appRequestWithRedirect('/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Password': `${testEnv().REPORT_PASSWORD}-wrong` },
            body: JSON.stringify({ stationId: station.id, source: 'web_app' }),
        })

        expect(response.status).toBe(503)
    })
})
