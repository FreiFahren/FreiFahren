// The Worker entry point injects Sentry's native logger at runtime; the optional sink keeps this module usable by tests and the seed CLI without pulling the Sentry SDK into those bundles.
// Privacy: log structured fields and lengths, never raw report/message text.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type Logger = {
    debug: (objOrMsg: unknown, msg?: string) => void
    info: (objOrMsg: unknown, msg?: string) => void
    warn: (objOrMsg: unknown, msg?: string) => void
    error: (objOrMsg: unknown, msg?: string) => void
}

export type LogAttributes = Record<string, unknown>

export type SentryLogSink = {
    [level in LogLevel]: (message: string, attributes?: LogAttributes) => void
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

// Sentry's console integration does not capture console.debug, so debug maps to console.log.
const CONSOLE_METHOD: Record<LogLevel, 'log' | 'info' | 'warn' | 'error'> = {
    debug: 'log',
    info: 'info',
    warn: 'warn',
    error: 'error',
}

let sentryLogSink: SentryLogSink | undefined

// Injected by worker.ts so @sentry/cloudflare stays out of the test and CLI bundles.
export const setSentryLogSink = (sink: SentryLogSink | undefined): void => {
    sentryLogSink = sink
}

const serializeError = (error: Error): LogAttributes => ({
    name: error.name,
    message: error.message,
    ...(error.stack === undefined ? {} : { stack: error.stack }),
})

const normalize = (objOrMsg: unknown, msg?: string): { message: string; attributes?: LogAttributes } => {
    if (typeof objOrMsg === 'string') return { message: objOrMsg }
    if (objOrMsg instanceof Error) {
        return { message: msg ?? objOrMsg.message, attributes: { err: serializeError(objOrMsg) } }
    }
    if (typeof objOrMsg === 'object' && objOrMsg !== null && !Array.isArray(objOrMsg)) {
        return { message: msg ?? '', attributes: objOrMsg as LogAttributes }
    }
    return { message: msg ?? '', attributes: { value: objOrMsg } }
}

const emit = (level: LogLevel, minLevel: LogLevel, objOrMsg: unknown, msg?: string): void => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return

    const method = CONSOLE_METHOD[level]
    const { message, attributes } = normalize(objOrMsg, msg)
    if (attributes === undefined) {
        console[method](message)
    } else {
        console[method](message, attributes)
    }
    sentryLogSink?.[level](message, attributes)
}

export const createLogger = (level: LogLevel = 'info'): Logger => ({
    debug: (objOrMsg, msg) => emit('debug', level, objOrMsg, msg),
    info: (objOrMsg, msg) => emit('info', level, objOrMsg, msg),
    warn: (objOrMsg, msg) => emit('warn', level, objOrMsg, msg),
    error: (objOrMsg, msg) => emit('error', level, objOrMsg, msg),
})

const resolveDefaultLevel = (): LogLevel => {
    const fromEnv = typeof process !== 'undefined' ? process.env.LOG_LEVEL : undefined
    return (fromEnv as LogLevel | undefined) ?? 'info'
}

// Used outside request handling (seed scripts, drizzle-kit); request handlers use the per-request logger.
export const logger: Logger = createLogger(resolveDefaultLevel())
