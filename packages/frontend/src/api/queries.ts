import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Itinerary, Line, LinesList, Position, Report, RiskData, StationList } from 'src/utils/types'

import { useSkeleton } from '../components/Miscellaneous/LoadingPlaceholder/Skeleton'
import { getClosestStations } from '../hooks/getClosestStations'
import { sendAnalyticsEvent } from '../hooks/useAnalytics'
import { CACHE_KEYS } from './queryClient'

const fetchReports = async (params: { from?: string; to?: string; stationId?: string }): Promise<Report[]> => {
    const search = new URLSearchParams()
    if (params.from !== undefined && params.from !== '') search.set('from', params.from)
    if (params.to !== undefined && params.to !== '') search.set('to', params.to)

    const path = params.stationId !== undefined && params.stationId !== '' ? `/v0/reports/${params.stationId}` : '/v0/reports'
    const query = search.toString()
    const url = `${import.meta.env.VITE_API_URL}${path}${query !== '' ? `?${query}` : ''}`

    const response = await fetch(url, { headers: { Accept: 'application/json' } })

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
}

export const useReportsByStation = (stationId: string, from?: string, to?: string) =>
    useQuery({
        queryKey: [...CACHE_KEYS.reports, stationId, from, to],
        queryFn: () => fetchReports({ stationId, from, to }),
    })

interface SubmitReportOptions {
    duration?: number
    meta?: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any
    }
}

export const useSubmitReport = (options?: SubmitReportOptions) => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (report: { stationId?: string; lineId?: string | null; directionId?: string | null }) => {
            const requestBody = {
                stationId: report.stationId,
                lineId: report.lineId ?? null,
                directionId: report.directionId ?? null,
                source: 'web_app' as const,
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL}/v0/reports`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                const error = new Error(errorData.message ?? `HTTP error! status: ${response.status}`)
                error.name = response.status.toString()
                throw error
            }

            return response.json()
        },
        onSuccess: (_, variables) => {
            sendAnalyticsEvent('Report Submitted', {
                meta: {
                    ...options?.meta,
                    stationId: variables.stationId,
                    lineId: variables.lineId,
                    directionId: variables.directionId,
                },
                duration: options?.duration,
            })
            // Invalidate relevant queries to refetch data
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.reports })
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.byTimeframe('24h') })
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.byTimeframe('1h') })
        },
        onError: (error: Error) => {
            // as a quick solution until we have a proper error monitoring set up
            sendAnalyticsEvent('Report Submission Failed', {
                meta: {
                    error: error.message,
                    status: error.name,
                },
            })
        },
    })
}

export const useFeedback = () =>
    useMutation({
        mutationFn: async (feedback: string): Promise<boolean> => {
            if (!feedback.trim()) {
                return false
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL}/v0/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedback }),
            })
            return response.ok
        },
    })

export const useCurrentReports = () => {
    const queryClient = useQueryClient()
    const queryResult = useQuery<Report[], Error>({
        queryKey: CACHE_KEYS.byTimeframe('1h'),
        queryFn: async (): Promise<Report[]> => {
            const to = new Date().toISOString()
            const from = new Date(new Date(to).getTime() - 60 * 60 * 1000).toISOString()

            const newData = await fetchReports({ from, to })

            // Refresh the risk cache shortly after new reports come in (temporary
            // fix to avoid a race condition between reports and risk data).
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: CACHE_KEYS.risk })
            }, 2.5 * 1000)

            // Separate predicted (synthesized) reports from real ones so the UI can
            // always show real reports first even when their timestamps overlap.
            const predictedReports = newData.filter((report) => report.isPredicted)
            const realReports = newData.filter((report) => !report.isPredicted)

            const sortedRealReports = realReports.sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )
            const sortedPredictedReports = predictedReports.sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )

            return [...sortedRealReports, ...sortedPredictedReports]
        },
        refetchInterval: 15 * 1000,
        staleTime: 2.5 * 60 * 1000,
        structuralSharing: true,
    })

    return {
        data: queryResult.data,
        error: queryResult.error,
        isLoading: queryResult.isLoading,
        isFetching: queryResult.isFetching,
        refetch: queryResult.refetch,
    }
}

export const useLast24HourReports = () => {
    const { data: lastHourReports = [] } = useCurrentReports()

    const queryResult = useQuery<Report[], Error>({
        queryKey: CACHE_KEYS.byTimeframe('24h'),
        queryFn: async (): Promise<Report[]> => {
            const to = new Date().toISOString()
            const from = new Date(new Date(to).getTime() - 24 * 60 * 60 * 1000).toISOString()

            const newData = await fetchReports({ from, to })

            // Remove the most recent hour, as that is replaced by current reports.
            const oneHourAgo = Date.now() - 60 * 60 * 1000
            return newData.filter((report) => new Date(report.timestamp).getTime() < oneHourAgo)
        },
        refetchInterval: 2 * 60 * 1000,
        staleTime: 5 * 60 * 1000,
        structuralSharing: true,
        placeholderData: keepPreviousData,
    })
    /*
     Combine the data: most recent hour first, then the rest of the 24h period
     becuase of fullDayReports wont contain historic data, (see docs for more info),
     this would cause the Last24HourReports to be misaligned with the current reports
    */
    const fullDayReports = useMemo(() => queryResult.data ?? [], [queryResult.data])
    fullDayReports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    const { isPlaceholderData } = queryResult

    const data = useMemo(() => {
        if (isPlaceholderData) return lastHourReports
        return [...lastHourReports, ...fullDayReports]
    }, [lastHourReports, fullDayReports, isPlaceholderData])

    return {
        data,
        isPlaceholderData,
        error: queryResult.error,
        isLoading: queryResult.isLoading,
    }
}

export const useRiskData = () => {
    const queryResult = useQuery<RiskData, Error>({
        queryKey: CACHE_KEYS.risk,
        queryFn: async (): Promise<RiskData> => {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/v1/risk-prediction/segment-colors`)
            return response.json()
        },
        refetchInterval: 30 * 1000,
        staleTime: 60 * 1000,
        structuralSharing: true,
    })

    return {
        data: queryResult.data ?? { segments_risk: {} },
        error: queryResult.error,
        isLoading: queryResult.isLoading,
        refetch: queryResult.refetch,
    }
}

export const fetchWithETag = async <T>(endpoint: string, storageKeyPrefix: string): Promise<T> => {
        const etagKey: string = `${storageKeyPrefix}ETag`
    const dataKey: string = `${storageKeyPrefix}Data`
    const cachedETag: string | null = localStorage.getItem(etagKey)

    const headers: HeadersInit = {
        Accept: 'application/json',
    }
    if (cachedETag !== null && cachedETag !== '') {
        headers['If-None-Match'] = cachedETag
    }

    const response: Response = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, { headers })
    const newETag: string | null = response.headers.get('ETag')

    if (response.status === 304) {
        const cachedData: string | null = localStorage.getItem(dataKey)
        if (cachedData !== null) {
            return JSON.parse(cachedData) as T
        }
    }

    if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`)
    }

    if (newETag !== null) {
        localStorage.setItem(etagKey, newETag)
    }

    const newData: T = await response.json()
    localStorage.setItem(dataKey, JSON.stringify(newData))
    return newData
}

export const useSegments = () =>
    useQuery<GeoJSON.FeatureCollection<GeoJSON.LineString>, Error>({
        queryKey: ['segmentsETag'],
        queryFn: () => fetchWithETag<GeoJSON.FeatureCollection<GeoJSON.LineString>>('/v0/transit/segments', 'segments'),
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
    })

export const useStations = () =>
    useQuery<StationList, Error>({
        queryKey: ['stationsETag'],
        queryFn: () => fetchWithETag<StationList>('/v0/transit/stations', 'stations'),
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
    })

export const useLines = () =>
    useQuery<Line[], Error>({
        queryKey: ['linesETag'],
        queryFn: async (): Promise<Line[]> => {
            const groupPriority = (id: string): number => {
                if (id.includes('U')) return 0
                if (id.includes('S')) return 1
                if (id.includes('M')) return 2
                if (/^\d+$/.test(id)) return 4 // Lowest priority (4) for numeric keys
                return 3 // Default priority (3) for others
            }

            const data = await fetchWithETag<LinesList>('/v0/transit/lines', 'lines')
            return [...data].sort((a, b) => {
                const groupA = groupPriority(a.id)
                const groupB = groupPriority(b.id)
                if (groupA !== groupB) {
                    return groupA - groupB
                }
                // Sort ascending within the same group (e.g., U1 before U9)
                return a.id.localeCompare(b.id, undefined, { numeric: true })
            })
        },
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        structuralSharing: true,
    })

export interface UseStationDistanceResult {
    distance: number | null
    isLoading: boolean
    shouldShowSkeleton: boolean
}

export const useStationDistance = (
    stationId: string,
    allStations: StationList,
    userLat?: number,
    userLng?: number
): UseStationDistanceResult => {
    const { data: distance, isLoading } = useQuery<number | null>({
        queryKey: ['stationDistance', stationId, userLat, userLng, allStations],
        queryFn: async () => {
            if (
                userLat === undefined ||
                Number.isNaN(userLat) ||
                userLng === undefined ||
                Number.isNaN(userLng) ||
                stationId.trim() === ''
            ) {
                return null
            }
            const stationsArray = Object.entries(allStations).map(([id, station]) => ({
                id,
                ...station,
            }))
            const [userStation] = getClosestStations(1, stationsArray, { lat: userLat, lng: userLng })
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/v0/transit/distance?inspectorStationId=${encodeURIComponent(
                    stationId
                )}&userStationId=${encodeURIComponent(userStation.id)}`
            )
            const data = await response.json()
            if (typeof data === 'number') return data
            return data.distance
        },
        enabled:
            typeof userLat === 'number' &&
            !Number.isNaN(userLat) &&
            typeof userLng === 'number' &&
            !Number.isNaN(userLng) &&
            stationId.trim() !== '',
    })

    /*
     Apply skeleton showing logic using our custom useSkeleton hook.
     This prevents flickering for fast responses by ensuring the skeleton is shown for a minimum time.
    */
    const shouldShowSkeleton = useSkeleton({
        isLoading,
        initialDelay: 100,
        minDisplayTime: 1000,
    })

    return {
        distance: distance ?? null,
        isLoading,
        shouldShowSkeleton,
    }
}

export const useStationReports = (stationId: string) =>
    useQuery<number, Error>({
        queryKey: CACHE_KEYS.stationReports(stationId),
        queryFn: async () => {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/v0/stations/${stationId}/statistics`)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()
            return data.numberOfReports as number
        },
    })

export type NavigationResponse = {
    requestParameters: Record<string, unknown>
    debugOutput: Record<string, unknown>
    from: Position
    to: Position
    direct: unknown[]
    safestItinerary: Itinerary
    alternativeItineraries: Itinerary[]
}

export const useNavigation = (startStationId: string, endStationId: string, options?: { enabled?: boolean }) =>
    useQuery<NavigationResponse, Error>({
        queryKey: CACHE_KEYS.navigation(startStationId, endStationId),
        queryFn: async () => {
            if (!startStationId || !endStationId) {
                return null
            }

            const response = await fetch(
                `${
                    import.meta.env.VITE_API_URL
                }/v0/transit/itineraries?startStation=${startStationId}&endStation=${endStationId}`
            )
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()
            return data
        },
        enabled: options?.enabled,
    })
