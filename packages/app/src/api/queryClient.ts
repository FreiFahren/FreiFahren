import { QueryClient } from '@tanstack/react-query'

export const CACHE_KEYS = {
    reports: ['reports'],
    stations: ['stations'],
    lines: ['lines'],
    risk: ['risk'],
    privacyPolicyMeta: ['privacy-policy-meta'],
    stationStatistics: (stationId: string) => ['station-statistics', stationId],
}

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: true,
            gcTime: Infinity,
        },
    },
})
