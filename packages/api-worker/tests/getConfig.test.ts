import { afterEach, describe, expect, it } from 'vitest'

import { db, stations } from './test-db'
import { appRequestWithRedirect, resetTestEnv, setTestEnv } from './test-utils'

type ConfigResponse = { reporting: { enabled: boolean } }

const getConfig = async () => {
    const response = await appRequestWithRedirect('/config')
    expect(response.status).toBe(200)
    return { response, body: (await response.json()) as ConfigResponse }
}

const postReport = async () => {
    const [station] = await db.select({ id: stations.id }).from(stations).limit(1)
    return appRequestWithRedirect('/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId: station.id, source: 'web_app' }),
    })
}

afterEach(() => {
    resetTestEnv()
})

describe('GET /v0/config', () => {
    it('reports the killswitch as closed while REPORTING_ENABLED is unset', async () => {
        const { body } = await getConfig()

        expect(body.reporting.enabled).toBe(false)
    })

    it('reports the killswitch as open once REPORTING_ENABLED is true', async () => {
        setTestEnv({ REPORTING_ENABLED: 'true' })

        const { body } = await getConfig()

        expect(body.reporting.enabled).toBe(true)
    })

    /*
     * The point of the endpoint is that a client can trust it instead of shipping its own copy of
     * the flag, so what it advertises has to be what POST /reports actually does.
     */
    it('advertises the same state that report submission enforces', async () => {
        const closed = await getConfig()
        expect(closed.body.reporting.enabled).toBe(false)
        const refused = await postReport()
        expect(refused.status).toBe(503)
        expect((await refused.json()) as { details: { internal_code: string } }).toMatchObject({
            details: { internal_code: 'REPORTING_DISABLED' },
        })

        setTestEnv({ REPORTING_ENABLED: 'true' })

        const open = await getConfig()
        expect(open.body.reporting.enabled).toBe(true)
        expect((await postReport()).status).toBe(200)
    })

    /*
     * A cached answer would strand clients on the previous state for as long as the entry lives,
     * which defeats a switch whose whole selling point is taking effect without a redeploy.
     */
    it('is never cached', async () => {
        const { response } = await getConfig()

        expect(response.headers.get('Cache-Control')).toBe('no-store')
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBeNull()
        expect(response.headers.get('Cache-Tag')).toBeNull()
    })
})
