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
    endpoints: ['/v0/transit/lines', '/v0/transit/stations', '/v0/transit/segments'],
})

etagMiddleware.applyMiddleware(client)

export const clearApiCache = etagMiddleware.clearAllCaches
export const clearEndpointCache = etagMiddleware.clearCache

export const reportSchema = z.object({
    timestamp: z.string().transform((value) => new Date(value)),
    stationId: z.string(),
    lineId: z.string().nullable(),
    directionId: z.string().nullable(),
    isPredicted: z.boolean(),
})

export type Report = z.infer<typeof reportSchema>
const getReports = async (start: DateTime, end: DateTime): Promise<Report[]> => {
    const { data } = await client.get('/v0/reports', {
        params: {
            from: start.toISO(),
            to: end.toISO(),
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
    stationId: string
    lineId: string | null
    directionId: string | null
}

const postReport = async (report: PostReport) => {
    const { data } = await client.post('/v0/reports', {
        stationId: report.stationId,
        lineId: report.lineId,
        directionId: report.directionId,
        source: 'mobile_app',
    })

    return reportSchema.parse({ ...data, isPredicted: false })
}

const riskSchema = z.object({
    segments_risk: z.record(
        z.object({
            color: z.string(),
            risk: z.number(),
        })
    ),
})

export type RiskData = z.infer<typeof riskSchema>

export const getRiskData = async (): Promise<RiskData> => {
    const { data } = await client.get('/v0/risk')

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
    const { data } = await client.get('/v0/transit/stations')

    return stationsSchema.parse(data)
}

export const lineSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['subway', 'tram', 'light_rail']),
    isCircular: z.boolean(),
    stations: z.array(z.string()),
})

export type Line = z.infer<typeof lineSchema>
export type LineType = Line['type']

export const linesSchema = z.array(lineSchema)
export type Lines = z.infer<typeof linesSchema>

export const getLines = async (): Promise<Lines> => {
    const { data } = await client.get('/v0/transit/lines')

    return linesSchema.parse(data)
}

export const featureCollectionSchema = z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(
        z.object({
            type: z.literal('Feature'),
            properties: z.object({
                id: z.number(),
                line: z.string(),
                from: z.string(),
                to: z.string(),
                color: z.string(),
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
    const { data } = await client.get('/v0/transit/segments')

    return featureCollectionSchema.parse(data)
}

export type StationStatistics = {
    numberOfReports: number
}

// Get reports for a specific station over the last 7 days to compute statistics
export const getStationReports = async (stationId: string): Promise<Report[]> => {
    const now = DateTime.utc()
    const sevenDaysAgo = now.minus({ days: 7 })

    const { data } = await client.get(`/v0/reports/${stationId}`, {
        params: {
            from: sevenDaysAgo.toISO(),
            to: now.toISO(),
        },
    })

    return reportSchema.array().parse(data)
}

export const getStationStatistics = async (stationId: string): Promise<StationStatistics> => {
    const reports = await getStationReports(stationId)

    return {
        numberOfReports: reports.length,
    }
}

// NOTE: Itineraries are not supported in the Hono backend yet.
// The web frontend has dropped its NavigationModal entirely.
// Uncomment and update these when backend support is added.
//
// export const nodeSchema = z.object({
//     name: z.string(),
//     stopId: z.string(),
//     lat: z.number(),
//     lon: z.number(),
//     departure: z.string().optional(),
//     scheduledDeparture: z.string().optional(),
//     arrival: z.string().optional(),
//     scheduledArrival: z.string().optional(),
// })
//
// export const legSchema = z.object({
//     mode: z.enum(['WALK', 'BUS', 'TRAM', 'METRO', 'SUBWAY', 'REGIONAL_RAIL']),
//     from: nodeSchema,
//     to: nodeSchema,
//     duration: z.number(),
//     startTime: z.string(),
//     endTime: z.string(),
//     scheduledStartTime: z.string(),
//     scheduledEndTime: z.string(),
//     realTime: z.boolean().optional(),
//     routeShortName: z.string().optional(),
//     intermediateStops: z.array(nodeSchema).optional(),
//     legGeometry: z.object({
//         points: z.string(),
//         length: z.number(),
//     }),
// })
//
// export const itinerarySchema = z.object({
//     duration: z.number(),
//     startTime: z.string(),
//     endTime: z.string(),
//     transfers: z.number(),
//     legs: z.array(legSchema),
//     calculatedRisk: z.number().optional(),
// })
//
// export const navigationResponseSchema = z.object({
//     requestParameters: z.record(z.unknown()),
//     debugOutput: z.record(z.unknown()),
//     from: nodeSchema,
//     to: nodeSchema,
//     direct: z.array(z.unknown()).default([]),
//     safestItinerary: itinerarySchema,
//     alternativeItineraries: z.array(itinerarySchema),
// })
//
// export type Itinerary = z.infer<typeof itinerarySchema>
// export type NavigationResponse = z.infer<typeof navigationResponseSchema>
// export type Leg = z.infer<typeof legSchema>
// export type Node = z.infer<typeof nodeSchema>
//
// export const getItineraries = async (start: string, end: string) => {
//     const { data } = await client.get(`/v0/transit/itineraries?startStation=${start}&endStation=${end}`)
//     const result = navigationResponseSchema.safeParse(data)
//
//     if (!result.success) {
//         return undefined
//     }
//
//     return result.data
// }

export const api = {
    getLines,
    getStations,
    getReports,
    getRecentReports,
    postReport,
    getRiskData,
    getStationStatistics,
    getSegments,
    // getItineraries, // Not supported in Hono backend yet
}
