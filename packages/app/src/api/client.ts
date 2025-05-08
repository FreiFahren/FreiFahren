import axios from 'axios'
import { DateTime } from 'luxon'
import { Platform } from 'react-native'
import DeviceInfo from 'react-native-device-info'
import { z } from 'zod'

import { config } from '../config'
import { createETagMiddleware } from './etagMiddleware'

export const client = axios.create({
    baseURL: config.FF_API_BASE_URL,
    validateStatus: () => true,
    headers: {
        'ff-app-version': DeviceInfo.getVersion(),
        'ff-platform': Platform.OS,
    },
})

const etagMiddleware = createETagMiddleware({
    endpoints: ['/v0/lines', '/v0/stations', '/v0/lines/segments'],
})

etagMiddleware.applyMiddleware(client)

export const clearApiCache = etagMiddleware.clearAllCaches
export const clearEndpointCache = etagMiddleware.clearCache

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

export const stationsSchema = z.record(stationSchema.optional())
export type Stations = z.infer<typeof stationsSchema>

export const getStations = async (): Promise<Stations> => {
    const { data } = await client.get('/v0/stations')

    return stationsSchema.parse(data)
}

export const linesSchema = z.record(z.array(z.string()))
export type Lines = z.infer<typeof linesSchema>

export const getLines = async (): Promise<Record<string, string[]>> => {
    const { data } = await client.get('/v0/lines')

    return linesSchema.parse(data)
}

export const featureCollectionSchema = z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(
        z.object({
            type: z.literal('Feature'),
            properties: z.object({
                sid: z.string(),
                line: z.string().optional(),
                line_color: z.string(),
            }),
            geometry: z.object({
                type: z.literal('LineString'),
                coordinates: z.array(z.array(z.number())),
            }),
        })
    ),
})

export type FeatureCollection = z.infer<typeof featureCollectionSchema>

export const getSegments = async (): Promise<FeatureCollection> => {
    const { data } = await client.get('/v0/lines/segments')

    return featureCollectionSchema.parse(data)
}

export const stationStatisticsSchema = z.object({
    numberOfReports: z.number(),
})

export type StationStatistics = z.infer<typeof stationStatisticsSchema>

export const getStationStatistics = async (stationId: string) => {
    const { data } = await client.get(`/v0/stations/${stationId}/statistics`)

    return stationStatisticsSchema.parse(data)
}

export const nodeSchema = z.object({
    name: z.string(),
    stopId: z.string(),
    lat: z.number(),
    lon: z.number(),
    departure: z.string().optional(),
    scheduledDeparture: z.string().optional(),
    arrival: z.string().optional(),
    scheduledArrival: z.string().optional(),
})

export const legSchema = z.object({
    mode: z.enum(['WALK', 'BUS', 'TRAM', 'METRO', 'SUBWAY', 'REGIONAL_RAIL']),
    from: nodeSchema,
    to: nodeSchema,
    duration: z.number(),
    startTime: z.string(),
    endTime: z.string(),
    scheduledStartTime: z.string(),
    scheduledEndTime: z.string(),
    realTime: z.boolean().optional(),
    routeShortName: z.string().optional(),
    intermediateStops: z.array(nodeSchema).optional(),
    legGeometry: z.object({
        points: z.string(),
        length: z.number(),
    }),
})

export const itinerarySchema = z.object({
    duration: z.number(),
    startTime: z.string(),
    endTime: z.string(),
    transfers: z.number(),
    legs: z.array(legSchema),
    calculatedRisk: z.number().optional(),
})

export const navigationResponseSchema = z.object({
    requestParameters: z.record(z.unknown()),
    debugOutput: z.record(z.unknown()),
    from: nodeSchema,
    to: nodeSchema,
    direct: z.array(z.unknown()).default([]),
    safestItinerary: itinerarySchema,
    alternativeItineraries: z.array(itinerarySchema),
})

export type Itinerary = z.infer<typeof itinerarySchema>
export type NavigationResponse = z.infer<typeof navigationResponseSchema>
export type Leg = z.infer<typeof legSchema>
export type Node = z.infer<typeof nodeSchema>

export const getItineraries = async (start: string, end: string) => {
    const { data } = await client.get(`/v0/transit/itineraries?startStation=${start}&endStation=${end}`)
    const result = navigationResponseSchema.safeParse(data)

    if (!result.success) {
        return undefined
    }

    return result.data
}

export const api = {
    getLines,
    getStations,
    getReports,
    getRecentReports,
    postReport,
    getRiskData,
    getStationStatistics,
    getSegments,
    getItineraries,
}
