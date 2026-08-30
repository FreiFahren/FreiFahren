import { env as workerEnv } from 'cloudflare:test'
import { vi } from 'vitest'

import type { Bindings } from '../src/app-env'
import { app } from '../src/index'
import type { PublicReportGate, ReportGateIntakeRequest } from '../src/modules/report-gate/report-gate-contract'

const overrides: Partial<Bindings> = {}

export const fakeReportGate = {
    minStationTrust: 1,
    intakeTrust: 1 as number | null,
    unavailable: false,
    lastIntake: undefined as Record<string, unknown> | undefined,
}

export const resetFakeReportGate = () => {
    fakeReportGate.minStationTrust = 1
    fakeReportGate.intakeTrust = 1
    fakeReportGate.unavailable = false
    fakeReportGate.lastIntake = undefined
}

const hashFor = (request: { ip?: unknown; userAgent?: unknown }): string =>
    `fake:${String(request.ip ?? '')}:${String(request.userAgent ?? '')}`.slice(0, 32)

const reportGateBinding: PublicReportGate = {
    async viewer(body) {
        if (fakeReportGate.unavailable) throw new Error('Fake report gate unavailable')
        return {
            ok: true,
            data: {
                clientHash: hashFor(body.request),
                minStationTrust: fakeReportGate.minStationTrust,
            },
        }
    },
    async intake(body: ReportGateIntakeRequest) {
        if (fakeReportGate.unavailable) throw new Error('Fake report gate unavailable')

        fakeReportGate.lastIntake = body as unknown as Record<string, unknown>
        if (!body.city.reporting.publicSubmissionsEnabled) {
            return {
                ok: false,
                error: {
                    message: 'Reporting is temporarily disabled',
                    statusCode: 503,
                    internalCode: 'REPORTING_DISABLED',
                },
            } as const
        }

        const cityDb = (workerEnv as unknown as Record<string, D1Database | undefined>)[body.city.dbBinding]
        if (cityDb === undefined) throw new Error('Unknown database binding')

        const now = Date.now()
        const row = await cityDb
            .prepare(
                `INSERT INTO reports
             (station_id, line_id, direction_id, timestamp, source, client_hash, trust)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             RETURNING report_id, station_id, line_id, direction_id, timestamp`
            )
            .bind(
                body.report.stationId,
                body.report.lineId,
                body.report.directionId,
                now,
                body.report.source,
                hashFor(body.request),
                fakeReportGate.intakeTrust
            )
            .first<{
                report_id: number
                station_id: string
                line_id: string | null
                direction_id: string | null
                timestamp: number
            }>()

        if (row === null) throw new Error('Insert failed')
        return {
            ok: true,
            data: {
                reportId: row.report_id,
                stationId: row.station_id,
                lineId: row.line_id,
                directionId: row.direction_id,
                timestamp: new Date(row.timestamp).toISOString(),
            },
        } as const
    },
}

export const setTestEnv = (values: Partial<Bindings>) => {
    Object.assign(overrides, values)
}

export const resetTestEnv = () => {
    for (const key of Object.keys(overrides)) delete overrides[key as keyof Bindings]
    resetFakeReportGate()
}

export const testEnv = (): Bindings => ({
    DB: workerEnv.DB,
    DB_HAMBURG: workerEnv.DB,
    DB_LEIPZIG: workerEnv.DB,
    CORS_ORIGINS: overrides.CORS_ORIGINS ?? workerEnv.CORS_ORIGINS,
    PREVIEW_WORKERS_SUBDOMAIN: overrides.PREVIEW_WORKERS_SUBDOMAIN ?? workerEnv.PREVIEW_WORKERS_SUBDOMAIN,
    REPORT_GATE_MODE: overrides.REPORT_GATE_MODE,
    NODE_ENV: overrides.NODE_ENV ?? workerEnv.NODE_ENV,
    LOG_LEVEL: (overrides.LOG_LEVEL ?? workerEnv.LOG_LEVEL) as Bindings['LOG_LEVEL'],
    STRIPE_WEBHOOK_SECRET: overrides.STRIPE_WEBHOOK_SECRET ?? workerEnv.STRIPE_WEBHOOK_SECRET,
    POSTHOG_API_KEY: overrides.POSTHOG_API_KEY ?? workerEnv.POSTHOG_API_KEY,
    POSTHOG_HOST: overrides.POSTHOG_HOST ?? workerEnv.POSTHOG_HOST,
    REPORT_GATE: overrides.REPORT_GATE ?? reportGateBinding,
})

export const setSystemTime = (date?: Date) => {
    if (date === undefined) {
        vi.useRealTimers()
        return
    }
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(date)
}

export const appRequestWithRedirect = async (path: string, init?: RequestInit, targetApp = app) => {
    const response = await targetApp.request(path, init, testEnv())
    if (response.status === 307) {
        const location = response.headers.get('Location')
        if (location) {
            const url = new URL(location, 'http://localhost')
            return targetApp.request(url.pathname + url.search, init, testEnv())
        }
    }
    return response
}

export const sendReportRequest = async (payload: object, routeApp = app) =>
    appRequestWithRedirect(
        '/reports',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        },
        routeApp
    )
