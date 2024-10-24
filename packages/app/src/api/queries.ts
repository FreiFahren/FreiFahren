import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, Report, reportSchema, RiskData } from './client'
import { CACHE_KEYS } from './queryClient'

export const useReports = <T = Report[]>(select?: (data: Report[]) => T) =>
    useQuery({
        queryKey: CACHE_KEYS.reports,
        queryFn: api.getRecentReports,
        staleTime: 1000 * 60,
        select,
        refetchInterval: 1000 * 60,
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
