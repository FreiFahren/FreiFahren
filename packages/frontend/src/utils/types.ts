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

export type Position = {
    name: string
    stopId: string
    lat: number
    lon: number
    level: number
    vertexType: string
    departure?: string
    scheduledDeparture?: string
    arrival?: string
    scheduledArrival?: string
    scheduledTrack?: string
    track?: string
}

export type LegGeometry = {
    points: string
    length: number
}

export type Leg = {
    mode: 'WALK' | 'BUS' | 'TRAM' | 'METRO' | 'SUBWAY' | 'REGIONAL_RAIL'
    from: Position
    to: Position
    duration: number
    startTime: string
    endTime: string
    scheduledStartTime: string
    scheduledEndTime: string
    realTime: boolean
    headsign?: string
    routeColor?: string
    routeTextColor?: string
    agencyName?: string
    agencyUrl?: string
    agencyId?: string
    tripId?: string
    routeShortName?: string
    source?: string
    intermediateStops?: Position[]
    legGeometry: LegGeometry
}

export type Itinerary = {
    duration: number
    startTime: string
    endTime: string
    transfers: number
    legs: Leg[]
    calculatedRisk?: number
}
