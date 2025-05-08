export interface StationProperty {
    name: string
    coordinates: {
        latitude: number
        longitude: number
    }
    lines: string[]
}

export type StationList = Record<string, StationProperty>
export type LinesList = Record<string, string[]>

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

// Added Position, Leg, Itinerary as they might be used by other copied parts indirectly
// or could be useful for future extensions of the form.
export type Position = {
    name: string
    stopId: string
    lat: number
    lon: number
    departure?: string
    scheduledDeparture?: string
    arrival?: string
    scheduledArrival?: string
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
    routeShortName?: string
    intermediateStops?: Position[]
    legGeometry: LegGeometry
}

export type Itinerary = {
    duration: number // in seconds
    startTime: string
    endTime: string
    transfers: number
    legs: Leg[]
    calculatedRisk?: number
}

export interface RiskData {
    segments_risk: {
        [key: string]: SegmentRisk
    }
}
export interface SegmentRisk {
    color: string
    risk: number
} 