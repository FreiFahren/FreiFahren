import { DurableObject } from 'cloudflare:workers'
import { AcceptedReportNotification } from './types'
import { DELIVERY_POLICY as policy } from './delivery-policy'
import { DeliveryStore, type DeliveryState } from './delivery-store'
import { deliveryEnabled, notificationCity, renderDelivery } from './forwarding'
import { sendTelegramMessage, TelegramDeliveryError } from './telegram-client'
import { reportError } from './observability'

export class CityDelivery extends DurableObject<Cloudflare.Env & { TELEGRAM_BOT_TOKEN?: string }> {
    private store = new DeliveryStore(this.ctx.storage.sql)

    async accept(input: AcceptedReportNotification): Promise<void> {
        const { city, report } = AcceptedReportNotification.parse(input)
        const config = notificationCity(city)
        if (report.source === 'telegram' || !deliveryEnabled(config, this.env)) return
        if (!this.env.TELEGRAM_BOT_TOKEN) throw new Error('Telegram bot token is not configured')
        const now = Date.now()
        if (Date.parse(report.timestamp) <= now - policy.maxReportAgeMs) return
        const state = this.store.state() ?? {
            city,
            credits: policy.messageCapacity,
            lastRefillAt: now,
            retryAfterUntil: 0,
            batch: null,
        }
        if (state.city !== city) throw new Error('City does not match delivery coordinator')
        this.store.prune(now)
        this.store.add(report, now)
        this.store.save(state)
        await this.schedule()
    }

    private refill(state: DeliveryState, now: number): void {
        const elapsed = Math.floor(Math.max(0, now - state.lastRefillAt) / policy.creditRefillMs)
        state.credits = Math.min(policy.messageCapacity, state.credits + elapsed)
        // Time spent with a full bucket cannot be banked for an extra immediate refill.
        state.lastRefillAt =
            state.credits === policy.messageCapacity ? now : state.lastRefillAt + elapsed * policy.creditRefillMs
    }

    private sendDue(state: DeliveryState, now: number): number {
        return Math.max(state.retryAfterUntil, state.credits > 0 ? now : state.lastRefillAt + policy.creditRefillMs)
    }

    private async schedule(): Promise<void> {
        const state = this.store.state()
        if (!state) return
        const now = Date.now()
        const due =
            (state.batch ? Math.min(Math.max(state.batch.due, this.sendDue(state, now)), state.batch.expires) : null) ??
            (this.store.pending() ? Math.max(now, this.sendDue(state, now)) : this.store.cleanupDue())
        if (due === null) await this.ctx.storage.deleteAlarm()
        else await this.ctx.storage.setAlarm(Math.max(now + 1, due))
    }

    async alarm(): Promise<void> {
        const now = Date.now()
        this.store.prune(now)
        const state = this.store.state()
        if (!state) return
        if (!deliveryEnabled(notificationCity(state.city), this.env)) {
            await this.clearDelivery()
            return
        }

        this.prepareBatch(state, now)
        if (state.batch && now >= Math.max(state.batch.due, this.sendDue(state, now))) {
            try {
                await this.deliverBatch(state)
            } catch (error) {
                this.handleDeliveryFailure(error)
            }
        }
        await this.schedule()
    }

    private async clearDelivery(): Promise<void> {
        this.store.clear()
        await this.ctx.storage.deleteAlarm()
    }

    private prepareBatch(state: DeliveryState, now: number): void {
        if (state.batch && now >= state.batch.expires) {
            this.store.finish('expired')
            state.batch = null
        }
        if (state.batch && state.batch.attempts >= policy.maxAttempts) {
            this.store.finish('failed')
            state.batch = null
        }
        this.refill(state, now)
        if (!state.batch && this.store.pending() && now >= this.sendDue(state, now)) {
            const reports = this.store.freeze()
            state.batch = {
                mode: reports.length === 1 ? 'individual' : 'digest',
                due: now,
                expires: Date.parse(reports[0].timestamp) + policy.maxReportAgeMs,
                attempts: 0,
            }
        }
        this.store.save(state)
    }

    private async deliverBatch(state: DeliveryState): Promise<void> {
        const batch = state.batch!
        batch.attempts++
        this.store.save(state)
        const text =
            batch.text ??
            (await renderDelivery(state.city, this.store.batchReports(), batch.mode, this.env, this.ctx))

        // Intake can run while transit/Telegram I/O is pending; reload state before writing it.
        state = this.store.state()!
        state.batch!.text = text
        if (!this.env.TELEGRAM_BOT_TOKEN) throw new Error('Telegram bot token is not configured')
        // Spend durably before network I/O, including attempts that time out.
        this.refill(state, Date.now())
        state.credits--
        this.store.save(state)
        await sendTelegramMessage(
            this.env.TELEGRAM_BOT_TOKEN,
            notificationCity(state.city).community.telegramChatId!,
            text
        )
        this.completeBatch()
        console.info('Telegram delivery sent', { city: state.city, mode: batch.mode })
    }

    private completeBatch(): void {
        const state = this.store.state()!
        this.store.finish('sent')
        state.batch = null
        this.store.save(state)
    }

    private handleDeliveryFailure(error: unknown): void {
        const state = this.store.state()!
        const batch = state.batch!
        const retryAfterMs = error instanceof TelegramDeliveryError ? error.retryAfterMs : undefined
        if (retryAfterMs !== undefined) {
            state.retryAfterUntil = Math.max(state.retryAfterUntil, Date.now() + retryAfterMs)
        }
        const retryable = !(error instanceof TelegramDeliveryError) || error.retryable
        if (retryable && batch.attempts < policy.maxAttempts) {
            batch.due = Date.now() + (retryAfterMs ?? policy.retryDelayMs * batch.attempts)
        } else {
            this.store.finish('failed')
            state.batch = null
        }
        this.store.save(state)
        reportError('Telegram scheduled delivery failed', error, {
            city: state.city,
            attempt: batch.attempts,
            retrying: state.batch !== null,
        })
    }
}
