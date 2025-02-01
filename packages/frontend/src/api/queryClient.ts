import { QueryClient } from '@tanstack/react-query'

export const CACHE_KEYS = {
    reports: ['reports'] as const,
    byTimeframe: (timeframe: '24h' | '1h') => ['reports', timeframe] as const,
    stations: ['stations'] as const,
    lines: ['lines'] as const,
    risk: ['risk'] as const,
    segments: ['segments'] as const,
    feedback: ['feedback'] as const,
    stationStatistics: (stationId: string) => ['station-statistics', stationId] as const,
    stationDistance: (stationId: string, userLat: number, userLng: number) =>
        ['station-distance', stationId, userLat, userLng] as const,
}

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {},
    },
})
