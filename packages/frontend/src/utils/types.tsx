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

export type LineProperty = {
    [key: string]: string[]
}

export type StationList = Record<string, StationProperty>
export type LinesList = Record<string, string[]>
export interface RiskData {
    segments_risk: {
        [key: string]: SegmentRisk
    }
}

export type Report = {
    timestamp: string
    station: {
        id: string
        name: string
        coordinates: {
            latitude: number
            longitude: number
        }
    }
    direction: {
        id: string
        name: string
        coordinates: {
            latitude: number
            longitude: number
        }
    } | null
    line: string | null
    isHistoric: boolean
    message: string | null
}
