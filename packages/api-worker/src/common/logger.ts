// On Workers, Sentry's consoleLoggingIntegration forwards console.{info,warn,error} to Sentry Logs.
// Privacy: log structured fields and lengths, never raw report/message text.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type Logger = {
    debug: (objOrMsg: unknown, msg?: string) => void
    info: (objOrMsg: unknown, msg?: string) => void
    warn: (objOrMsg: unknown, msg?: string) => void
    error: (objOrMsg: unknown, msg?: string) => void
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

// Sentry's console integration does not capture console.debug, so debug maps to console.log.
const CONSOLE_METHOD: Record<LogLevel, 'log' | 'info' | 'warn' | 'error'> = {
    debug: 'log',
    info: 'info',
    warn: 'warn',
    error: 'error',
}

const emit = (level: LogLevel, minLevel: LogLevel, objOrMsg: unknown, msg?: string): void => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return

    const method = CONSOLE_METHOD[level]
    if (typeof objOrMsg === 'string') {
        console[method](objOrMsg)
        return
    }
    console[method](msg ?? '', objOrMsg)
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
