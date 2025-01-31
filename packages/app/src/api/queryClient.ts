import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'

import { useAppStore } from '../app.store'
import { track } from '../tracking'

export const CACHE_KEYS = {
    reports: ['reports'],
    stations: ['stations'],
    lines: ['lines'],
    risk: ['risk'],
    privacyPolicyMeta: ['privacy-policy-meta'],
    stationStatistics: (stationId: string) => ['station-statistics', stationId],
}

const onError = (error: unknown) => {
    if (error instanceof AxiosError && error.response?.status === 410) {
        track({ name: 'App Deprecated' })
        useAppStore.getState().update({ deprecated: true })
    }
}

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: true,
            gcTime: Infinity,
        },
    },
    queryCache: new QueryCache({
        onError,
    }),
    mutationCache: new MutationCache({
        onError,
    }),
})
