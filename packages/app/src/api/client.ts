import axios from 'axios'
import { DateTime } from 'luxon'
import { Platform } from 'react-native'
import DeviceInfo from 'react-native-device-info'
import { z } from 'zod'

import { config } from '../config'

export const reportSchema = z
    .object({
        timestamp: z.string().transform((value) => new Date(value)),
        line: z.string().transform((value: string) => (value === '' ? null : value)),
        isHistoric: z.boolean().default(false),
        direction: z
            .object({
                id: z.string(),
                name: z.string(),
            })
            .transform((value) => (value.name === '' || value.id === '' ? null : value)),
        station: z.object({
            id: z.string(),
        }),
    })
    .transform(({ station, ...rest }) => ({
        ...rest,
        stationId: station.id,
    }))

export type Report = z.infer<typeof reportSchema>

const client = axios.create({
    baseURL: config.FF_API_BASE_URL,
    headers: {
        'ff-app-version': DeviceInfo.getVersion(),
        'ff-platform': Platform.OS,
    },
})

const getReports = async (start: DateTime, end: DateTime): Promise<Report[]> => {
    const { data } = await client.get('/v0/basics/inspectors', {
        params: {
            start: start.toISO(),
            end: end.toISO(),
        },
    })

    return reportSchema.array().parse(data)
}

const getRecentReports = async (): Promise<Report[]> => {
    const now = DateTime.utc()
    const oneHourAgo = now.minus({ hours: 1 })

    return getReports(oneHourAgo, now)
}

type PostReport = {
    line: string
    stationId: string
    directionId: string | null
    message?: string
}

const postReport = async (report: PostReport) => {
    const { data } = await client.post('/v0/basics/inspectors', {
        ...report,
        directionId: report.directionId ?? '',
    })

    return reportSchema.parse(data)
}

const riskSchema = z
    .object({
        last_modified: z.string().transform((value) => new Date(value)),
        segment_colors: z.record(z.string()),
    })
    .transform(({ last_modified, segment_colors }) => ({
        lastModified: last_modified,
        segmentColors: segment_colors,
    }))

export type RiskData = z.infer<typeof riskSchema>

export const getRiskData = async (): Promise<RiskData> => {
    const { data } = await client.get('/v0/risk-prediction/segment-colors')

    return riskSchema.parse(data)
}

export const stationSchema = z.object({
    name: z.string(),
    coordinates: z.object({
        latitude: z.number(),
        longitude: z.number(),
    }),
    lines: z.array(z.string()),
})

export type Station = z.infer<typeof stationSchema>

export const stationsSchema = z.record(stationSchema)
export type Stations = z.infer<typeof stationsSchema>

export const getStations = async (): Promise<Record<string, Station>> => {
    const { data } = await client.get('/v0/stations')

    return stationsSchema.parse(data)
}

export const linesSchema = z.record(z.array(z.string()))
export type Lines = z.infer<typeof linesSchema>

export const getLines = async (): Promise<Record<string, string[]>> => {
    const { data } = await client.get('/v0/lines')

    return linesSchema.parse(data)
}

export const stationStatisticsSchema = z.object({
    numberOfReports: z.number(),
})

export type StationStatistics = z.infer<typeof stationStatisticsSchema>

export const getStationStatistics = async (stationId: string) => {
    const { data } = await client.get(`/v0/stations/${stationId}/statistics`)

    return stationStatisticsSchema.parse(data)
}

export const api = {
    getLines,
    getStations,
    getReports,
    getRecentReports,
    postReport,
    getRiskData,
    getStationStatistics,
}
