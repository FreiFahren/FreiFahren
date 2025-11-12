/* eslint-disable no-console  */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { lines, lineStations } from '../schema/lines'
import { stations } from '../schema/stations'

import linesListJson from './LinesList.json'
import stationsListJson from './StationsList.json'

const connectionString = process.env.DATABASE_URL!

if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
}

const client = postgres(connectionString, { prepare: false })
const db = drizzle(client, { casing: 'snake_case' })

interface StationData {
    coordinates: {
        latitude: number
        longitude: number
    }
    lines: string[]
    name: string
}

interface StationsMap {
    [key: string]: StationData
}

interface LinesMap {
    [key: string]: string[]
}

const seed = async () => {
    console.log('Starting seed...')

    const stationsData = stationsListJson as StationsMap
    const linesData = linesListJson as LinesMap

    console.log('Inserting stations...')
    const stationRecords = Object.entries(stationsData).map(([id, data]) => ({
        id,
        name: data.name,
        lat: data.coordinates.latitude,
        lng: data.coordinates.longitude,
    }))

    await db.insert(stations).values(stationRecords).onConflictDoNothing()
    console.log(`Inserted ${stationRecords.length} stations`)

    console.log('Inserting lines...')
    const lineRecords = Object.keys(linesData).map((id) => ({
        id,
        name: id,
    }))

    await db.insert(lines).values(lineRecords).onConflictDoNothing()
    console.log(`Inserted ${lineRecords.length} lines`)

    console.log('Inserting station-line relationships...')
    const stationLineRecords: Array<{
        stationId: string
        lineId: string
        order: number
    }> = []

    for (const [lineId, stationIds] of Object.entries(linesData)) {
        stationIds.forEach((stationId, index) => {
            stationLineRecords.push({
                stationId,
                lineId,
                order: index,
            })
        })
    }

    await db.insert(lineStations).values(stationLineRecords).onConflictDoNothing()
    console.log(`Inserted ${stationLineRecords.length} station-line relationships`)

    console.log('Seed completed successfully!')
    await client.end()
}

seed().catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
})
