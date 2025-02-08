import { Hono } from 'hono'
import { StationList } from './index'

// Define the type for your context
type ServerContext = {
    stationsFreiFahren: StationList
    stationsMap: Record<string, string>
}

const app = new Hono()

// Store the context
let serverContext: ServerContext = {
    stationsFreiFahren: {},
    stationsMap: {},
}

app.get('/', (c) => {
    console.log(serverContext.stationsFreiFahren)
    return c.text(`Hello Hono!`)
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
