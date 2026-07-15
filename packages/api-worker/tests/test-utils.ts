import { env as workerEnv } from 'cloudflare:test'
import { vi } from 'vitest'

import { Bindings } from '../src/app-env'
import { app } from '../src/index'

// Per-test overrides so a suite can flip an env var (e.g. NODE_ENV, TELEGRAM_WORKER_URL) without
// mutating the shared worker bindings. Cleared between suites via resetTestEnv().
const overrides: Partial<Bindings> = {}

export const setTestEnv = (values: Partial<Bindings>) => {
    Object.assign(overrides, values)
}

export const resetTestEnv = () => {
    for (const key of Object.keys(overrides)) {
        delete overrides[key as keyof Bindings]
    }
}

// Derived on every call so a test can flip an override right before a request and have it take effect.
export const testEnv = (): Bindings => ({
    DB: workerEnv.DB,
    CORS_ORIGINS: overrides.CORS_ORIGINS ?? workerEnv.CORS_ORIGINS,
    PREVIEW_WORKERS_SUBDOMAIN: overrides.PREVIEW_WORKERS_SUBDOMAIN ?? workerEnv.PREVIEW_WORKERS_SUBDOMAIN,
    NODE_ENV: overrides.NODE_ENV ?? workerEnv.NODE_ENV,
    TELEGRAM_WORKER_URL: overrides.TELEGRAM_WORKER_URL ?? workerEnv.TELEGRAM_WORKER_URL,
    REPORT_PASSWORD: overrides.REPORT_PASSWORD ?? workerEnv.REPORT_PASSWORD,
    LOG_LEVEL: (overrides.LOG_LEVEL ?? workerEnv.LOG_LEVEL) as Bindings['LOG_LEVEL'],
})

/**
 * Mock the system clock. `setSystemTime(date)` freezes Date at `date`; `setSystemTime()` restores
 * the real clock. Only Date is faked (not setTimeout/setInterval), matching how the old bun:test
 * helper behaved. luxon's `DateTime.now()` reads the faked `Date.now()`, so both are affected.
 */
export const setSystemTime = (date?: Date) => {
    if (date === undefined) {
        vi.useRealTimers()
        return
    }
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(date)
}

/**
 * Sends a request to the app and follows the version redirect so tests exercise the latest API
 * version without hard-coding `/v0/...` paths. No ExecutionContext is passed, so background
 * cache.default writes stay inert here; requests behave like the previous libsql tests, just
 * against real D1.
 */
export const appRequestWithRedirect = async (path: string, init?: RequestInit, targetApp = app) => {
    const response = await targetApp.request(path, init, testEnv())
    if (response.status === 307) {
        const location = response.headers.get('Location')
        if (location) {
            const url = new URL(location)
            return targetApp.request(url.pathname + url.search, init, testEnv())
        }
    }
    return response
}

/**
 * Sends a report request to the app.
 */
export const sendReportRequest = async (payload: object, routeApp = app) => {
    return appRequestWithRedirect(
        '/reports',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Password': testEnv().REPORT_PASSWORD ?? '',
            },
            body: JSON.stringify(payload),
        },
        routeApp
    )
}
