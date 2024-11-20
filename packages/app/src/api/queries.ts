import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, Lines, Report, reportSchema, RiskData, Stations } from './client'
import { CACHE_KEYS } from './queryClient'

export const useLines = <T = Lines>(select?: (data: Lines) => T) =>
    useQuery({
        queryKey: CACHE_KEYS.lines,
        queryFn: api.getLines,
        staleTime: Infinity,
        select,
    })

export const useStations = <T = Stations>(select?: (data: Stations) => T) =>
    useQuery({
        queryKey: CACHE_KEYS.stations,
        queryFn: api.getStations,
        staleTime: Infinity,
        select,
    })

export const useReports = <T = Report[]>(select?: (data: Report[]) => T) =>
    useQuery({
        queryKey: CACHE_KEYS.reports,
        queryFn: api.getRecentReports,
        staleTime: 1000 * 10,
        select,
        refetchInterval: 1000 * 10,
    })

export const useSubmitReport = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: api.postReport,
        onSuccess: async (newReport: unknown) => {
            const parsedReport = reportSchema.parse(newReport)

            queryClient.setQueryData(CACHE_KEYS.reports, (oldReports: Report[]) => [...oldReports, parsedReport])
        },
    })
}

export const useRiskData = <T = RiskData>(select?: (data: RiskData) => T) =>
    useQuery({
        queryKey: CACHE_KEYS.risk,
        queryFn: api.getRiskData,
        staleTime: 1000 * 60,
        select,
        refetchInterval: 1000 * 60,
    })
