import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db, reports, stations } from './test-db'
import { appRequestWithRedirect, fakeReportGate, resetTestEnv, setTestEnv } from './test-utils'

let stationId: string

beforeEach(async () => {
    const [station] = await db.select({ id: stations.id }).from(stations).limit(1)
    stationId = station!.id
    await db.delete(reports).where(eq(reports.stationId, stationId))

    fakeReportGate.unavailable = true
    setTestEnv({ REPORT_GATE_MODE: 'preview-open' })
})

afterEach(async () => {
    resetTestEnv()
    await db.delete(reports).where(eq(reports.stationId, stationId))
})

describe('open report previews', () => {
    it('accepts and exposes reports without the private gate', async () => {
        const post = await appRequestWithRedirect('/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stationId, source: 'web_app' }),
        })

        expect(post.status).toBe(200)
        expect(await post.json()).toMatchObject({ stationId })

        const [stored] = await db
            .select({ trust: reports.trust, clientHash: reports.clientHash, trustFlags: reports.trustFlags })
            .from(reports)
            .where(eq(reports.stationId, stationId))
        expect(stored).toEqual({ trust: 1, clientHash: null, trustFlags: null })

        const get = await appRequestWithRedirect(`/reports/${stationId}`)
        expect(get.status).toBe(200)
        const body = (await get.json()) as Array<{ isPredicted: boolean; trust?: unknown; clientHash?: unknown }>
        const visible = body.find((report) => !report.isPredicted)
        expect(visible).toBeDefined()
        expect(visible).not.toHaveProperty('trust')
        expect(visible).not.toHaveProperty('clientHash')
    })

    it('reports that intake is enabled without consulting the private gate', async () => {
        const response = await appRequestWithRedirect('/config')
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({ reporting: { enabled: true } })
    })

    it('keeps viewer-dependent risk reads available without the private gate', async () => {
        const response = await appRequestWithRedirect('/risk')
        expect(response.status).toBe(200)
    })
})
