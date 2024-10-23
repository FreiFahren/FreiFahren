import axios from 'axios'
import { DateTime } from 'luxon'
import { Platform } from 'react-native'
import DeviceInfo from 'react-native-device-info'
import { z } from 'zod'

import { config } from '../config'
import { stations } from '../data'

export const reportSchema = z
    .object({
        timestamp: z.string().transform((value) => new Date(value)),
        line: z.string().transform((value: string) => (value === '' ? null : value)),
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
    .transform((value) => {
        if (value.line !== null) return value

        if (stations[value.stationId].lines.length === 1) {
            return {
                ...value,
                line: stations[value.stationId].lines[0],
            }
        }

        return value
    })

export type Report = z.infer<typeof reportSchema>

const client = axios.create({
    baseURL: config.FF_API_BASE_URL,
    headers: {
        'ff-app-version': DeviceInfo.getVersion(),
        'ff-platform': Platform.OS,
        'Cache-Control': 'no-cache',
    },
})

const getReports = async (start: DateTime, end: DateTime): Promise<Report[]> => {
    const { data } = await client.get('/basics/inspectors', {
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

const stationSchema = z.object({
    name: z.string(),
    coordinates: z.object({
        latitude: z.number(),
        longitude: z.number(),
    }),
    lines: z.array(z.string()),
})

export type Station = z.infer<typeof stationSchema>

type PostReport = {
    line: string
    stationId: string
    directionId: string
    message?: string
}

const postReport = async (report: PostReport) => {
    const { data } = await client.post('/basics/inspectors', report)

    return data
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
    const { data } = await client.get('/risk-prediction/segment-colors')

    return riskSchema.parse(data)
}

export const api = {
    getReports,
    getRecentReports,
    postReport,
    getRiskData,
}
