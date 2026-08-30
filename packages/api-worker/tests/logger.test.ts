import { afterEach, describe, expect, it, vi } from 'vitest'

import { createLogger, setSentryLogSink, type SentryLogSink } from '../src/common/logger'

describe('structured logger', () => {
    afterEach(() => {
        setSentryLogSink(undefined)
        vi.restoreAllMocks()
    })

    it('passes structured fields to the Sentry sink separately from the message', () => {
        const sink: SentryLogSink = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        setSentryLogSink(sink)

        createLogger().warn({ outcome: 'refused', platform: 'ios' }, 'Request verification')

        expect(sink.warn).toHaveBeenCalledWith('Request verification', {
            outcome: 'refused',
            platform: 'ios',
        })
        expect(consoleWarn).toHaveBeenCalledWith('Request verification', {
            outcome: 'refused',
            platform: 'ios',
        })
    })

    it('normalizes Error values into safe structured attributes', () => {
        const sink: SentryLogSink = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        setSentryLogSink(sink)
        const error = new Error('upstream failed')

        createLogger().error(error, 'Report copy failed')

        expect(sink.error).toHaveBeenCalledWith(
            'Report copy failed',
            expect.objectContaining({ err: expect.objectContaining({ name: 'Error', message: 'upstream failed' }) })
        )
    })

    it('applies the configured minimum level to the Sentry sink', () => {
        const sink: SentryLogSink = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }
        vi.spyOn(console, 'info').mockImplementation(() => undefined)
        setSentryLogSink(sink)

        createLogger('warn').info({ ignored: true }, 'Below threshold')

        expect(sink.info).not.toHaveBeenCalled()
    })
})
