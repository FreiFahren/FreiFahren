import { DateTime, DurationLike } from 'luxon'

const STANDARD_REPORTS_TIMEFRAME: DurationLike = { minutes: 60 }

// Compile trick to show that MAX_REPORTS_TIMEFRAME is Days and not a number
type Days = number & { readonly __brand: 'Days' }
export const MAX_REPORTS_TIMEFRAME = 7 as Days

export const getDefaultReportsRange = (now: DateTime = DateTime.now()) => {
    const to = now
    const from = now.minus(STANDARD_REPORTS_TIMEFRAME)

    return { from, to }
}
