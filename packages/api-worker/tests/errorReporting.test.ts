import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { setErrorReporter } from '../src/app-env'
import { AppError } from '../src/common/errors'
import { createApp } from '../src/index'

import { appRequestWithRedirect, sendReportRequest, testEnv } from './test-utils'

const captured: Error[] = []

setErrorReporter((error) => {
    captured.push(error as Error)
})

// worker.ts is not part of the test bundle, so the reporter is a no-op unless a suite injects one.
// Put it back so a later suite cannot see this one's captures.
afterAll(() => {
    setErrorReporter(() => undefined)
})

/*
 * The 500-status AppErrors in production (a failed risk model, a station inference that hit an
 * impossible clock) are all unreachable from outside — that is the point of them. Routes that throw
 * on demand are the only way to drive those branches, so this suite mounts its own on a real app
 * rather than going through the versioned surface the other suites use.
 */
const throwingApp = () => {
    const routeApp = createApp()
    routeApp.get('/boom/unhandled', () => {
        throw new Error('kaboom')
    })
    routeApp.get('/boom/app-error-500', () => {
        throw new AppError({ message: 'Risk model failed', statusCode: 500, internalCode: 'RISK_MODEL_FAILED' })
    })
    routeApp.get('/boom/app-error-404', () => {
        throw new AppError({ message: 'Station not found', statusCode: 404, internalCode: 'STATION_NOT_FOUND' })
    })
    return routeApp
}

describe('error reporting to Sentry', () => {
    beforeEach(() => {
        captured.length = 0
    })

    it('captures an unhandled error', async () => {
        const response = await throwingApp().request('/boom/unhandled', undefined, testEnv())

        expect(response.status).toBe(500)
        expect(captured.map((error) => error.message)).toEqual(['kaboom'])
    })

    // The regression the reviewer caught: keying on `instanceof AppError` rather than on the status
    // left every one of these invisible, which is the exact class of bug this reporting is for.
    it('captures an AppError that carries a 500', async () => {
        const response = await throwingApp().request('/boom/app-error-500', undefined, testEnv())

        expect(response.status).toBe(500)
        expect(captured.map((error) => error.message)).toEqual(['Risk model failed'])
    })

    it('does not capture an AppError below 500', async () => {
        const response = await throwingApp().request('/boom/app-error-404', undefined, testEnv())

        expect(response.status).toBe(404)
        expect(captured).toEqual([])
    })

    it('does not capture a rejected report', async () => {
        const response = await sendReportRequest({ stationId: 'no-such-stn', source: 'web_app' })

        expect(response.status).toBe(422)
        expect(captured).toEqual([])
    })

    it('does not capture an unknown city', async () => {
        const response = await appRequestWithRedirect('/reports?city=atlantis')

        expect(response.status).toBe(400)
        expect(captured).toEqual([])
    })
})
