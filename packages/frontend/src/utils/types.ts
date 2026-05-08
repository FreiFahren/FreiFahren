/* eslint-disable @typescript-eslint/no-explicit-any */

export {} // to make this file a module

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

export interface StationGeoJSON {
    type: string
    features: {
        type: string
        properties: {
            name: string
            lines: string[]
        }
        geometry: {
            type: string
            coordinates: number[]
        }
    }[]
}

export interface SegmentRisk {
    color: string
    risk: number
}

export interface StationProperty {
    name: string
    coordinates: {
        latitude: number
        longitude: number
    }
    lines: string[]
}

export interface Station {
    id: string
    name: string
    coordinates: {
        latitude: number
        longitude: number
    }
    lines: string[]
}

export type LineProperty = {
    [key: string]: string[]
}

export type StationList = Record<string, StationProperty>

export interface Line {
    id: string
    name: string
    stations: string[]
}

export type LinesList = Line[]

export interface SegmentProperties {
    line: string
    from: string
    to: string
    color: string
}

export type SegmentFeature = GeoJSON.Feature<GeoJSON.LineString, SegmentProperties>

export type SegmentsFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.LineString, SegmentProperties>
export interface RiskData {
    segments_risk: {
        [key: string]: SegmentRisk
    }
}

export type Report = {
    timestamp: string
    stationId: string
    directionId: string | null
    lineId: string | null
    isPredicted: boolean
}

