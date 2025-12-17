import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'

import { useAppStore } from '../app.store'

export const CACHE_KEYS = {
    reports: ['reports'],
    stations: ['stations'],
    lines: ['lines'],
    segments: ['segments'],
    risk: ['risk'],
    privacyPolicyMeta: ['privacy-policy-meta'],
    stationStatistics: (stationId: string) => ['station-statistics', stationId],
    itineraries: (start: string, end: string) => ['itineraries', start, end],
}

const onError = (error: unknown) => {
    if (error instanceof AxiosError && error.response?.status === 410) {
        useAppStore.getState().update({ deprecated: true })
    } else {
        throw error
    }
}

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: Infinity,
            throwOnError: true,
        },
        mutations: {
            throwOnError: true,
        },
    },
    queryCache: new QueryCache({
        onError,
    }),
    mutationCache: new MutationCache({
        onError,
    }),
})
