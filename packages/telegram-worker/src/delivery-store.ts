import type { AcceptedReportNotification } from './types'
import { DELIVERY_POLICY as policy } from './delivery-policy'

type Report = AcceptedReportNotification['report']
export type DeliveryMode = 'individual' | 'digest'
export interface Batch {
    mode: DeliveryMode
    due: number
    expires: number
    attempts: number
    text?: string
}
export interface DeliveryState {
    city: string
    credits: number
    lastRefillAt: number
    retryAfterUntil: number
    batch: Batch | null
}

export class DeliveryStore {
    constructor(private sql: SqlStorage) {
        sql.exec(
            `CREATE TABLE IF NOT EXISTS delivery_state (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL)`
        )
        sql.exec(`CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY, payload TEXT NOT NULL, received INTEGER NOT NULL,
            observed INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending'
        )`)
        sql.exec('CREATE INDEX IF NOT EXISTS reports_received ON reports(received)')
        sql.exec('CREATE INDEX IF NOT EXISTS reports_status_observed ON reports(status, observed)')
    }

    state(): DeliveryState | null {
        const row = this.sql.exec<{ value: string }>('SELECT value FROM delivery_state WHERE id = 1').toArray()[0]
        return row ? JSON.parse(row.value) : null
    }

    save(state: DeliveryState): void {
        this.sql.exec('INSERT OR REPLACE INTO delivery_state (id, value) VALUES (1, ?)', JSON.stringify(state))
    }

    add(report: Report, now: number): void {
        this.sql.exec(
            'INSERT OR IGNORE INTO reports (id, payload, received, observed) VALUES (?, ?, ?, ?)',
            report.reportId,
            JSON.stringify(report),
            now,
            Date.parse(report.timestamp)
        )
    }

    pending(): boolean {
        return this.sql.exec("SELECT id FROM reports WHERE status = 'pending' LIMIT 1").toArray().length > 0
    }

    freeze(): Report[] {
        this.sql.exec("UPDATE reports SET status = 'batched' WHERE status = 'pending'")
        return this.batchReports()
    }

    batchReports(): Report[] {
        return this.sql
            .exec<{ payload: string }>("SELECT payload FROM reports WHERE status = 'batched' ORDER BY observed, id")
            .toArray()
            .map((row) => JSON.parse(row.payload))
    }

    finish(status: 'sent' | 'expired' | 'failed'): void {
        this.sql.exec("UPDATE reports SET status = ? WHERE status = 'batched'", status)
    }

    prune(now: number): void {
        this.sql.exec(
            "UPDATE reports SET status = 'expired' WHERE status = 'pending' AND observed <= ?",
            now - policy.maxReportAgeMs
        )
        this.sql.exec("DELETE FROM reports WHERE received <= ? AND status != 'batched'", now - policy.retentionMs)
    }

    clear(): void {
        this.sql.exec('DELETE FROM reports')
        this.sql.exec('DELETE FROM delivery_state')
    }

    cleanupDue(): number | null {
        const row = this.sql.exec<{ received: number | null }>('SELECT min(received) AS received FROM reports').one()
        return row.received === null ? null : row.received + policy.retentionMs
    }
}
