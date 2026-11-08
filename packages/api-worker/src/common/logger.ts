import { createLogger, type LogLevel } from '@freifahren/worker-kit/logger'

const resolveDefaultLevel = (): LogLevel => {
    const fromEnv = typeof process !== 'undefined' ? process.env.LOG_LEVEL : undefined
    return (fromEnv as LogLevel | undefined) ?? 'info'
}

// Used outside request handling (seed scripts, drizzle-kit); request handlers use the per-request logger.
export const logger = createLogger(resolveDefaultLevel())
