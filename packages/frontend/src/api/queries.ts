import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Itinerary, LinesList, Position, Report, RiskData, StationList } from 'src/utils/types'

import { useSkeleton } from '../components/Miscellaneous/LoadingPlaceholder/Skeleton'
import { getClosestStations } from '../hooks/getClosestStations'
import { CACHE_KEYS } from './queryClient'

const fetchNewReports = async (
    startTime?: string,
    endTime?: string,
    stationId?: string,
    lastKnownTimestamp?: string
): Promise<Report[] | null> => {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    }

    let queryParams = ''

    if (lastKnownTimestamp !== undefined && lastKnownTimestamp.trim() !== '') {
        const date = new Date(lastKnownTimestamp)
        headers['If-Modified-Since'] = date.toUTCString()
    }

    if (startTime !== undefined && startTime.trim() !== '') {
        queryParams += `&start=${startTime}`
    }

    if (endTime !== undefined && endTime.trim() !== '') {
        queryParams += `&end=${endTime}`
    }

    if (stationId !== undefined && stationId.trim() !== '') {
        queryParams += `&station=${stationId}`
    }

    const response = await fetch(`${import.meta.env.VITE_API_URL}/v0/basics/inspectors?${queryParams}`, { headers })

    if (response.status === 304) {
        return null
    }

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
}

export const useReportsByStation = (stationId: string, startTime?: string, endTime?: string) =>
    useQuery({
        queryKey: [...CACHE_KEYS.reports, stationId, startTime, endTime],
        queryFn: () => fetchNewReports(startTime, endTime, stationId),
    })

export const useSubmitReport = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (report: Report) => {
            const requestBody = {
                timestamp: new Date(report.timestamp),
                line: report.line ?? '',
                stationId: report.station.id,
                directionId: report.direction?.id ?? '',
                message: report.message ?? '',
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL}/v0/basics/inspectors`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            return response.json()
        },
        onSuccess: () => {
            // Invalidate relevant queries to refetch data
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.reports })
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.byTimeframe('24h') })
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.byTimeframe('1h') })
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
            const endTime = new Date().toISOString()
            const startTime = new Date(new Date(endTime).getTime() - 60 * 60 * 1000).toISOString()

            // Get previous data from the queryClient instead of destructuring from outer scope.
            const prevData = queryClient.getQueryData<Report[]>(CACHE_KEYS.byTimeframe('1h')) ?? []
            const lastKnownTimestamp = prevData[0]?.timestamp

            const result = await fetchNewReports(startTime, endTime, undefined, lastKnownTimestamp)
            const newData = result === null ? prevData : result

            // If we got new data, invalidate the risk cache (temporary fix to avoid race condition)
            if (result !== null) {
                setTimeout(() => {
                    queryClient.invalidateQueries({ queryKey: CACHE_KEYS.risk })
                }, 2.5 * 1000)
            }

            // Separate historic and non-historic reports
            const historicReports = newData.filter((report) => report.isHistoric)
            const currentReports = newData.filter((report) => !report.isHistoric)

            // Sort each group by timestamp (newest first)
            const sortedCurrentReports = currentReports.sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )
            const sortedHistoricReports = historicReports.sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )

            /*
             Combine the sorted groups: current reports first, then historic
             Necessary because historic reports have a guessed timestamp of between 45 and 60 minutes ago
             This means that sometimes the historic reports will be returned first, but we should always
             show the real reports first.
            */
            return [...sortedCurrentReports, ...sortedHistoricReports]
        },
        refetchInterval: 15 * 1000,
        staleTime: 2.5 * 60 * 1000,
        structuralSharing: true,
    })

    return { ...queryResult, isFetching: queryResult.isFetching }
}

export const useLast24HourReports = () => {
    const { data: lastHourReports = [] } = useCurrentReports()
    const queryClient = useQueryClient()

    const queryResult = useQuery<Report[], Error>({
        queryKey: CACHE_KEYS.byTimeframe('24h'),
        queryFn: async (): Promise<Report[]> => {
            const endTime = new Date().toISOString()
            const startTime = new Date(new Date(endTime).getTime() - 24 * 60 * 60 * 1000).toISOString()

            // Retrieve previous 24h reports via queryClient instead of outer scope.
            const prevData = queryClient.getQueryData<Report[]>(CACHE_KEYS.byTimeframe('24h')) ?? []
            const lastKnownTimestamp = prevData[0]?.timestamp

            const result = await fetchNewReports(startTime, endTime, undefined, lastKnownTimestamp)
            const newData = result === null ? prevData : result

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
        queryFn: () => fetchWithETag<GeoJSON.FeatureCollection<GeoJSON.LineString>>('/v0/lines/segments', 'segments'),
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
    })

export const useStations = () =>
    useQuery<StationList, Error>({
        queryKey: ['stationsETag'],
        queryFn: () => fetchWithETag<StationList>('/v0/stations', 'stations'),
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
    })

export const useLines = () =>
    useQuery<[string, string[]][], Error>({
        queryKey: ['linesETag'],
        queryFn: async (): Promise<[string, string[]][]> => {
            const groupPriority = (key: string): number => {
                if (key.includes('U')) return 0
                if (key.includes('S')) return 1
                if (key.includes('M')) return 2
                if (/^\d+$/.test(key)) return 4 // Lowest priority (4) for numeric keys
                return 3 // Default priority (3) for others
            }

            const data = await fetchWithETag<LinesList>('/v0/lines', 'lines')
            const sortedEntries = Object.entries(data).sort((a, b) => {
                const groupA = groupPriority(a[0])
                const groupB = groupPriority(b[0])
                if (groupA !== groupB) {
                    return groupA - groupB
                }
                // Sort ascending within the same group (e.g., U1 before U9)
                return a[0].localeCompare(b[0], undefined, { numeric: true })
            })

            return sortedEntries
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
