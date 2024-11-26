import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { z } from 'zod'

import { config } from '../config'
import { api, Lines, Report, RiskData, Stations, StationStatistics } from './client'
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
        onSuccess: async (newReport: Report) => {
            queryClient.setQueryData(CACHE_KEYS.reports, (oldReports: Report[]) => [...oldReports, newReport])

            return newReport
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

export const usePrivacyPolicyMeta = () =>
    useQuery({
        queryKey: CACHE_KEYS.privacyPolicyMeta,
        queryFn: async () => {
            const { data } = await axios.get(config.PRIVACY_POLICY_META_URL)

            return z
                .object({
                    lastModified: z.string().transform((date) => new Date(date)),
                    version: z.number(),
                })
                .parse(data)
        },
    })

export const useStationStatistics = <T = StationStatistics>(
    stationId: string | undefined,
    select?: (data: StationStatistics) => T
) =>
    useQuery({
        queryKey: stationId !== undefined ? CACHE_KEYS.stationStatistics(stationId) : [],
        queryFn: () => api.getStationStatistics(stationId!),
        staleTime: 1000 * 60,
        select,
        enabled: stationId !== undefined,
    })
