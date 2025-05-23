import { QueryClient } from '@tanstack/react-query'

export const CACHE_KEYS = {
    reports: ['reports'] as const,
    byTimeframe: (timeframe: '24h' | '1h') => ['reports', timeframe] as const,
    stations: ['stations'] as const,
    lines: ['lines'] as const,
    risk: ['risk'] as const,
    segments: ['segments'] as const,
    feedback: ['feedback'] as const,
    stationReports: (stationId: string) => ['station-reports', stationId] as const,
    stationDistance: (stationId: string, userLat: number, userLng: number) =>
        ['station-distance', stationId, userLat, userLng] as const,
    navigation: (startStationId: string, endStationId: string) => ['navigation', startStationId, endStationId] as const,
}

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {},
    },
})
