import { Hono } from 'hono'
import { StationList } from './index'
import { writeFileSync } from 'fs'

interface SegmentRisk {
    color: string
    risk: number
}

interface RiskData {
    segments_risk: {
        [key: string]: SegmentRisk
    }
}

interface Position {
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

interface LegGeometry {
    points: string
    length: number
}

interface Leg {
    mode: 'WALK' | 'SUBWAY' | 'TRAM' | 'BUS' | 'RAIL'
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

interface DebugOutput {
    direct: number
    execute_time: number
    fastest_direct: number
    fp_update_prevented_by_lower_bound: number
    interval_extensions: number
    lb_time: number
    n_dest_offsets: number
    n_earliest_arrival_updated_by_footpath: number
    n_earliest_arrival_updated_by_route: number
    n_earliest_trip_calls: number
    n_footpaths_visited: number
    n_routes_visited: number
    n_routing_time: number
    n_start_offsets: number
    n_td_dest_offsets: number
    n_td_start_offsets: number
    query_preparation: number
    route_update_prevented_by_lower_bound: number
}

interface Itinerary {
    duration: number
    startTime: string
    endTime: string
    transfers: number
    legs: Leg[]
    calculated_risk?: number
}

interface EngineResponse {
    requestParameters: Record<string, unknown>
    debugOutput: DebugOutput
    from: Position
    to: Position
    direct: any[]
    itineraries: Itinerary[]
}

interface RouteResponse {
    requestParameters: Record<string, unknown>
    debugOutput: DebugOutput
    from: Position
    to: Position
    direct: any[]
    safestRoute: Itinerary
    alternativeRoutes: Itinerary[]
}

type ServerContext = {
    stationsFreiFahren: StationList
    stationsMap: Record<string, string>
    currentRisk: RiskData
}

interface RouteRequest {
    startStation: string
    endStation: string
}

const app = new Hono()

let serverContext: ServerContext = {
    stationsFreiFahren: {},
    stationsMap: {},
    currentRisk: {
        segments_risk: {},
    },
}

function calculateLegRisk(leg: Leg, riskData: RiskData): number {
    // Skip walking legs
    if (leg.mode === 'WALK') return 0

    const line = leg.routeShortName
    if (!line) return 0

    // Get station IDs from the engines format
    const fromId = leg.from.stopId.split(':').pop() || ''
    const toId = leg.to.stopId.split(':').pop() || ''

    // Try both directions of the segment
    const forwardKey = `${line}.${fromId}:${toId}`
    const reverseKey = `${line}.${toId}:${fromId}`

    const segmentRisk = riskData.segments_risk[forwardKey] || riskData.segments_risk[reverseKey]
    return segmentRisk?.risk || 0
}

function calculateItineraryRisk(itinerary: Itinerary, riskData: RiskData): number {
    let totalRisk = 0
    let transitLegs = 0

    for (const leg of itinerary.legs) {
        const risk = calculateLegRisk(leg, riskData)
        totalRisk += risk
        transitLegs++
    }

    // Return average risk across transit legs
    return transitLegs > 0 ? totalRisk / transitLegs : 0 // Question: Average or sum?
}

app.post('/routes', async (c) => {
    try {
        const body = await c.req.json<RouteRequest>()
        const { startStation, endStation } = body

        // Convert station IDs using the map
        const startStationId = serverContext.stationsMap[startStation]
        const endStationId = serverContext.stationsMap[endStation]

        if (!startStationId || !endStationId) {
            return c.json(
                {
                    error: 'Invalid station IDs provided',
                    details: {
                        startStationFound: !!startStationId,
                        endStationFound: !!endStationId,
                    },
                },
                400
            )
        }

        // Get current time in ISO format
        const currentTime = new Date().toISOString()

        // Construct the URL with query parameters
        const url = new URL(process.env.ENGINE_URL + '/plan')
        url.searchParams.set('time', currentTime)
        url.searchParams.set('fromPlace', startStationId)
        url.searchParams.set('toPlace', endStationId)
        url.searchParams.set('arriveBy', 'false')
        url.searchParams.set('timetableView', 'true')
        url.searchParams.set('pedestrianProfile', 'FOOT')
        url.searchParams.set('preTransitModes', 'WALK')
        url.searchParams.set('postTransitModes', 'WALK')
        url.searchParams.set('directModes', 'WALK')
        url.searchParams.set('requireBikeTransport', 'false')

        const response = await fetch(url.toString())

        if (!response.ok) {
            return c.json(
                {
                    error: 'Failed to fetch route from engine',
                    status: response.status,
                },
                502
            )
        }

        const routeData: EngineResponse = await response.json()

        const itinerariesWithRisk = routeData.itineraries.map((itinerary: Itinerary) => ({
            ...itinerary,
            calculated_risk: calculateItineraryRisk(itinerary, serverContext.currentRisk),
        }))

        // Find the safest route
        const safestRoute = [...itinerariesWithRisk].sort(
            (a, b) => (a.calculated_risk || 0) - (b.calculated_risk || 0)
        )[0]

        // Filter out the safest route and keep original order for alternatives (limited to 5)
        const alternativeRoutes = itinerariesWithRisk.filter((route: Itinerary) => route !== safestRoute).slice(0, 4) // Take only 4 alternatives (plus safest route = 5 total)

        // Construct clean response
        const enrichedResponse: RouteResponse = {
            requestParameters: routeData.requestParameters,
            debugOutput: routeData.debugOutput,
            from: routeData.from,
            to: routeData.to,
            direct: routeData.direct,
            safestRoute,
            alternativeRoutes,
        }

        // dump the routeData to a file for debugging // Todo: remove when done
        writeFileSync('routeData.json', JSON.stringify(enrichedResponse, null, 2))

        return c.json(enrichedResponse)
    } catch (error) {
        console.error('Error processing route request:', error)
        return c.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            500
        )
    }
})

// Server configuration and setup
const server = {
    fetch: app.fetch,
    port: 7070,
    setContext(context: Partial<ServerContext>) {
        serverContext = { ...serverContext, ...context }
    },
    getContext(): ServerContext {
        return serverContext
    },
}

export default server
