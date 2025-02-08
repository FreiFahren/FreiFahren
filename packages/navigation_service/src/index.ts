import server from './server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export type StationList = Record<string, StationProperty>
export interface StationProperty {
    name: string
    coordinates: {
        latitude: number
        longitude: number
    }
    lines: string[]
}

const getStationsFreiFahren = async () => {
    const response = await fetch(`${process.env.BACKEND_URL}/v0/stations`)
    return response.json()
}

const getStationsMap = async () => {
    const filePath = join(__dirname, 'stationsMap.json')
    const fileContent = await readFile(filePath, 'utf-8')
    return JSON.parse(fileContent)
}

const init = async () => {
    console.log('Initializing server...')

    const stationsFreiFahren = await getStationsFreiFahren()
    const stationsMap = await getStationsMap()

    server.setContext({
        stationsFreiFahren,
        stationsMap,
    })
}

async function startServer() {
    await init()

    // Start the server
    Bun.serve({
        fetch: server.fetch,
        port: server.port,
    })
}

startServer()
