const MINUTE = 60_000

export const DELIVERY_POLICY = {
    // Applies to every Telegram send attempt, including retries after ambiguous timeouts.
    messageCapacity: 3,
    creditRefillMs: 10 * MINUTE,
    maxReportAgeMs: 30 * MINUTE,
    retentionMs: 24 * 60 * MINUTE,
    retryDelayMs: 30_000,
    maxAttempts: 3,
    maxDigestStations: 5,
} as const
