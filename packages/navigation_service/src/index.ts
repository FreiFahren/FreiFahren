import server from './server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import * as cron from 'node-cron'

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
    console.log('The backend url is', process.env.BACKEND_URL)
    const response = await fetch(`${process.env.BACKEND_URL}/v0/stations`)
    return response.json()
}

const getStationsMap = async () => {
    const filePath = join(__dirname, '../stationsMap.prod.json')
    const fileContent = await readFile(filePath, 'utf-8')
    return JSON.parse(fileContent)
}

const getCurrentRisk = async () => {
    const response = await fetch(`${process.env.BACKEND_URL}/v1/risk-prediction/segment-colors`)
    return response.json()
}

const init = async () => {
    console.log('Initializing server...')

    const stationsFreiFahren = await getStationsFreiFahren()
    const stationsMap = await getStationsMap()
    const currentRisk = await getCurrentRisk()

    server.setContext({
        stationsFreiFahren,
        stationsMap,
        currentRisk,
    })

    // fetch current risk every minute
    cron.schedule('* * * * *', async () => {
        try {
            const updatedRisk = await getCurrentRisk()
            server.setContext({
                stationsFreiFahren,
                stationsMap,
                currentRisk: updatedRisk,
            })
        } catch (error) {
            console.error('Failed to update current risk data:', error)
        }
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
