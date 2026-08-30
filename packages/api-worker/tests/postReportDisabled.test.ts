import { afterEach, describe, expect, it } from 'vitest'
import { BERLIN } from '@freifahren/cities'

import { db, stations } from './test-db'
import { appRequestWithRedirect, fakeReportGate, resetTestEnv } from './test-utils'

afterEach(() => {
    BERLIN.reporting.publicSubmissionsEnabled = true
    resetTestEnv()
})

describe.sequential('POST /v0/reports gate failures', () => {
    it('stops public intake from the central city switch before calling the private gate', async () => {
        BERLIN.reporting.publicSubmissionsEnabled = false
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)
        const response = await appRequestWithRedirect('/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stationId: station.id, source: 'web_app' }),
        })

        expect(response.status).toBe(503)
        expect((await response.json()) as { details: { internal_code: string } }).toMatchObject({
            details: { internal_code: 'REPORTING_DISABLED' },
        })
        expect(fakeReportGate.lastIntake).toBeUndefined()

        const read = await appRequestWithRedirect('/reports')
        expect(read.status).toBe(200)
    })

    it('fails closed without inserting when the gate is unavailable', async () => {
        fakeReportGate.unavailable = true
        const [station] = await db.select({ id: stations.id }).from(stations).limit(1)
        const response = await appRequestWithRedirect('/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stationId: station.id, source: 'web_app' }),
        })

        expect(response.status).toBe(503)
        expect((await response.json()) as { details: { internal_code: string } }).toMatchObject({
            details: { internal_code: 'REPORT_GATE_UNAVAILABLE' },
        })
    })
})
