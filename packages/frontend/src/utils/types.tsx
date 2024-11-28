/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from "zod";

export { } // to make this file a module

declare global {
    interface Window {
        pirsch: (eventName: string, options: { duration?: number; meta?: Record<string, any> }) => void
    }
}

export interface AnalyticsMeta {
    [key: string]: any
}

export interface AnalyticsOptions {
    duration?: number
    meta?: AnalyticsMeta
}

export type SavedEvent = {
    eventName: string
    options: AnalyticsOptions
    timestamp: number
}

// Station Feature Schema
export const stationFeatureSchema = z.object({
    type: z.string(),
    properties: z.object({
        name: z.string(),
        lines: z.array(z.string())
    }),
    geometry: z.object({
        type: z.string(),
        coordinates: z.array(z.number())
    })
})
export type StationFeature = z.infer<typeof stationFeatureSchema>

// Station GeoJSON Schema
export const stationGeoJSONSchema = z.object({
    type: z.string(),
    features: z.array(stationFeatureSchema)
})
export type StationGeoJSON = z.infer<typeof stationGeoJSONSchema>

// Segment Colors Schema
export const segmentColorsSchema = z.record(z.string())
export type SegmentColors = z.infer<typeof segmentColorsSchema>

// Risk Data Schema
export const riskDataSchema = z.object({
    last_modified: z.string(),
    segment_colors: segmentColorsSchema
})
export type RiskData = z.infer<typeof riskDataSchema>

// Marker Data Schema
export const markerDataSchema = z.object({
    timestamp: z.string(),
    station: z.object({
        id: z.string(),
        name: z.string(),
        coordinates: z.object({
            latitude: z.number(),
            longitude: z.number()
        })
    }),
    direction: z.object({
        id: z.string(),
        name: z.string(),
        coordinates: z.object({
            latitude: z.number(),
            longitude: z.number()
        })
    }),
    line: z.string(),
    isHistoric: z.boolean(),
    message: z.string().optional()
})
export type MarkerData = z.infer<typeof markerDataSchema>

// Statistics Schema
export const statisticsSchema = z.object({
    numberOfReports: z.number()
})
export type Statistics = z.infer<typeof statisticsSchema>
