import { Hono } from 'hono'
import { StationList } from './index'
import { writeFileSync } from 'fs'

// Define the type for your context
type ServerContext = {
    stationsFreiFahren: StationList
    stationsMap: Record<string, string>
}

interface RouteRequest {
    startStation: string
    endStation: string
}

const app = new Hono()

// Store the context
let serverContext: ServerContext = {
    stationsFreiFahren: {},
    stationsMap: {},
}

app.post('/route', async (c) => {
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
        const url = new URL('https://api.transitous.org/api/v1/plan')
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

        // Make the request to the engine
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

        const routeData = await response.json()
        // dump the routeData to a file
        writeFileSync('routeData.json', JSON.stringify(routeData, null, 2))

        return c.json(routeData)
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
