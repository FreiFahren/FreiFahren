import { DateTime, Duration, DurationLike } from 'luxon'

export const DEFAULT_REPORTS_TIMEFRAME: DurationLike = { minutes: 60 }
export const REPORTS_CACHE_TTL_MS = 1 * 60 * 1000

// Compile trick to show that MAX_REPORTS_TIMEFRAME is Days and not a number
type Days = number & { readonly __brand: 'Days' }
export const MAX_REPORTS_TIMEFRAME = 7 as Days

export const getDefaultReportsRange = (now: DateTime = DateTime.now()) => {
    const to = now
    const from = now.minus(DEFAULT_REPORTS_TIMEFRAME)

    return { from, to }
}

export const isDefaultReportsWindow = ({ from, to, now }: { from: DateTime; to: DateTime; now: DateTime }): boolean => {
    const defaultRangeMillis = Duration.fromDurationLike(DEFAULT_REPORTS_TIMEFRAME).toMillis()
    const requestedRangeMillis = to.diff(from).toMillis()
    const toAgeMillis = now.diff(to).toMillis()

    // If the requested range is the same as the default range and the to timestamp is within the cache ttl, return true
    return requestedRangeMillis === defaultRangeMillis && toAgeMillis >= 0 && toAgeMillis <= REPORTS_CACHE_TTL_MS
}
