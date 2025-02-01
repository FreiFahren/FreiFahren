import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { getNearestStation } from '../utils/mapUtils'
import { useMemo } from 'react'
import { LinesList, Report, RiskData, StationList } from 'src/utils/types'
import { CACHE_KEYS } from './queryClient'
import { useSkeleton } from '../components/Miscellaneous/LoadingPlaceholder/Skeleton'

const fetchNewReports = async (
    startTime: string,
    endTime: string,
    lastKnownTimestamp?: string
): Promise<Report[] | null> => {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    }

    if (lastKnownTimestamp) {
        const date = new Date(lastKnownTimestamp)
        headers['If-Modified-Since'] = date.toUTCString()
    }

    const response = await fetch(
        `${process.env.REACT_APP_API_URL}/v0/basics/inspectors?start=${startTime}&end=${endTime}`,
        { headers }
    )

    if (response.status === 304) {
        return null
    }

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
}

export const useSubmitReport = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (report: Report) => {
            const requestBody = {
                timestamp: new Date(report.timestamp),
                line: report.line || '',
                stationId: report.station.id,
                directionId: report.direction?.id || '',
                message: report.message || '',
            }

            const response = await fetch(`${process.env.REACT_APP_API_URL}/v0/basics/inspectors`, {
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

export const useFeedback = () => {
    return useMutation({
        mutationFn: async (feedback: string): Promise<boolean> => {
            if (!feedback.trim()) {
                return false
            }

            const response = await fetch(`${process.env.REACT_APP_API_URL}/v0/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedback }),
            })
            return response.ok
        },
    })
}

export const useCurrentReports = () => {
    const queryClient = useQueryClient()

    const { data = [], ...query } = useQuery<Report[], Error>({
        queryKey: CACHE_KEYS.byTimeframe('1h'),
        queryFn: async ({ queryKey }): Promise<Report[]> => {
            const endTime = new Date().toISOString()
            const startTime = new Date(new Date(endTime).getTime() - 60 * 60 * 1000).toISOString()
            const lastKnownTimestamp = data[0]?.timestamp

            const result = await fetchNewReports(startTime, endTime, lastKnownTimestamp)
            const newData = result === null ? data : result

            // If we got new data, invalidate the risk cache
            if (result !== null) {
                // temporary fix to avoid race condition. // todo: handle this better on the backend with mutex
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

    return { data, ...query } as const
}

export const useLast24HourReports = () => {
    const { data: lastHourReports = [] } = useCurrentReports()

    const {
        data: fullDayReports = [],
        isPlaceholderData,
        ...query
    } = useQuery<Report[], Error>({
        queryKey: CACHE_KEYS.byTimeframe('24h'),
        queryFn: async ({ queryKey }): Promise<Report[]> => {
            const endTime = new Date().toISOString()
            const startTime = new Date(new Date(endTime).getTime() - 24 * 60 * 60 * 1000).toISOString()
            const lastKnownTimestamp = fullDayReports[0]?.timestamp

            const result = await fetchNewReports(startTime, endTime, lastKnownTimestamp)
            const newData = result === null ? fullDayReports : result

            // Remove the most recent hour from the 24h data since it will be replaced by lastHourReports
            const oneHourAgo = new Date(new Date().getTime() - 60 * 60 * 1000)
            const reportsExcludingLastHour = newData.filter((report) => new Date(report.timestamp) < oneHourAgo)

            return reportsExcludingLastHour
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
    const data = useMemo(() => {
        // If we're showing placeholder data, just show the last hour reports
        if (isPlaceholderData) return lastHourReports

        // Once we have real data, combine both sets
        return [...lastHourReports, ...fullDayReports]
    }, [lastHourReports, fullDayReports, isPlaceholderData])

    return { data, isPlaceholderData, ...query } as const
}

export const useRiskData = () => {
    const { data = { segment_colors: {} }, ...query } = useQuery<RiskData, Error>({
        queryKey: CACHE_KEYS.risk,
        queryFn: async ({ queryKey }): Promise<RiskData> => {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/v0/risk-prediction/segment-colors`)
            return response.json()
        },
        refetchInterval: 30 * 1000,
        staleTime: 60 * 1000,
        structuralSharing: true,
    })

    return { data, ...query } as const
}

export async function fetchWithETag<T>(endpoint: string, storageKeyPrefix: string): Promise<T> {
    const etagKey: string = `${storageKeyPrefix}ETag`
    const dataKey: string = `${storageKeyPrefix}Data`
    const cachedETag: string | null = localStorage.getItem(etagKey)

    const headers: HeadersInit = {
        Accept: 'application/json',
    }
    if (cachedETag) {
        headers['If-None-Match'] = cachedETag
    }

    const response: Response = await fetch(`${process.env.REACT_APP_API_URL}${endpoint}`, { headers })
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

export const useSegments = () => {
    return useQuery<GeoJSON.FeatureCollection<GeoJSON.LineString>, Error>({
        queryKey: ['segmentsETag'],
        queryFn: () => fetchWithETag<GeoJSON.FeatureCollection<GeoJSON.LineString>>('/v0/lines/segments', 'segments'),
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
    })
}

export const useStations = () => {
    return useQuery<StationList, Error>({
        queryKey: ['stationsETag'],
        queryFn: () => fetchWithETag<StationList>('/v0/stations', 'stations'),
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
    })
}

export const useLines = () => {
    return useQuery<LinesList, Error>({
        queryKey: ['linesETag'],
        queryFn: () => fetchWithETag<LinesList>('/v0/lines', 'lines'),
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
    })
}

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
        queryKey: ['stationDistance', stationId, userLat, userLng],
        queryFn: async () => {
            if (userLat === undefined || userLng === undefined || !stationId) {
                return null
            }
            const userStation = getNearestStation(allStations, userLat, userLng)
            if (userStation && userStation.key !== '' && stationId !== '') {
                const response = await fetch(
                    `${process.env.REACT_APP_API_URL}/v0/transit/distance?inspectorStationId=${encodeURIComponent(
                        stationId
                    )}&userStationId=${encodeURIComponent(userStation.key)}`
                )
                const data = await response.json()
                if (typeof data === 'number') return data
                return data.distance
            }
            return null
        },
        enabled: Boolean(userLat && userLng && stationId),
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

export const useStationReports = (stationId: string) => {
    return useQuery<number, Error>({
        queryKey: CACHE_KEYS.stationReports(stationId),
        queryFn: async () => {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/v0/stations/${stationId}/statistics`)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()
            return data.numberOfReports as number
        },
    })
}
