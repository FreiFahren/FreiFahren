import { afterEach, describe, expect, it } from 'vitest'

import { appRequestWithRedirect, fakeReportGate, resetTestEnv } from './test-utils'

type ConfigResponse = {
    reporting: { enabled: boolean }
    city: {
        slug: string
        displayName: string
        timezone: string
        map: { center: readonly [number, number] }
    }
}

const getConfig = async (path = '/config') => {
    const response = await appRequestWithRedirect(path)
    expect(response.status).toBe(200)
    return { response, body: (await response.json()) as ConfigResponse }
}

afterEach(() => resetTestEnv())

describe('GET /v0/config', () => {
    it('returns the city reporting switch and centrally resolved city config', async () => {
        const { body } = await getConfig('/config?city=hamburg')

        expect(body.reporting.enabled).toBe(true)
        expect(body.city).toMatchObject({
            slug: 'hamburg',
            displayName: 'Hamburg',
            timezone: 'Europe/Berlin',
            map: { center: expect.any(Array) },
        })
        expect(body.city).not.toHaveProperty('community.telegramChatId')
        expect(fakeReportGate.lastIntake).toBeUndefined()
    })

    it('reads the central switch even when the private gate is unavailable', async () => {
        fakeReportGate.unavailable = true
        const { body } = await getConfig()
        expect(body.reporting.enabled).toBe(true)
    })

    it('is never cached', async () => {
        const { response } = await getConfig()
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBeNull()
        expect(response.headers.get('Cache-Tag')).toBeNull()
    })
})
