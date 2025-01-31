import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Report } from 'src/utils/types'
import { CACHE_KEYS } from './queryClient'

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

export const useCurrentReports = () => {
    const { data = [], ...query } = useQuery<Report[], Error>({
        queryKey: CACHE_KEYS.byTimeframe('1h'),
        queryFn: async ({ queryKey }): Promise<Report[]> => {
            const endTime = new Date().toISOString()
            const startTime = new Date(new Date(endTime).getTime() - 60 * 60 * 1000).toISOString()
            const lastKnownTimestamp = data[0]?.timestamp

            const result = await fetchNewReports(startTime, endTime, lastKnownTimestamp)
            return result === null ? data : result
        },
        refetchInterval: 15 * 1000,
        staleTime: 2.5 * 60 * 1000,
        structuralSharing: true,
    })

    return { data, ...query } as const
}

export const useLast24HourReports = () => {
    const { data = [], ...query } = useQuery<Report[], Error>({
        queryKey: CACHE_KEYS.byTimeframe('24h'),
        queryFn: async ({ queryKey }): Promise<Report[]> => {
            const endTime = new Date().toISOString()
            const startTime = new Date(new Date(endTime).getTime() - 24 * 60 * 60 * 1000).toISOString()
            const lastKnownTimestamp = data[0]?.timestamp

            const result = await fetchNewReports(startTime, endTime, lastKnownTimestamp)
            return result === null ? data : result
        },
        refetchInterval: 2 * 60 * 1000,
        staleTime: 5 * 60 * 1000,
        structuralSharing: true,
    })

    return { data, ...query } as const
}
