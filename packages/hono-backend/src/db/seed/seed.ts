import type { DbConnection } from '../index'
import { lines, lineStations } from '../schema/lines'
import { reports } from '../schema/reports'
import { stations } from '../schema/stations'

import linesListJson from './LinesList.json'
import stationsListJson from './StationsList.json'

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

const createDeterministicRandom = (seed: number) => {
    // Deterministic pseudo random generator for repeatable seeds (Park–Miller LCG)
    let state = Math.abs(Math.floor(seed)) % 2147483647
    if (state === 0) state = 1
    return () => {
        state = (state * 48271) % 2147483647
        return state / 2147483647
    }
}

const pickOne = <T>(items: T[], randomFloat: () => number): T => {
    const index = Math.floor(randomFloat() * items.length)
    const item = items[index]
    if (item === undefined) {
        throw new Error('Cannot pick from an empty list')
    }
    return item
}

export const seedBaseData = async (db: DbConnection) => {
    const stationsData = stationsListJson as StationsMap
    const linesData = linesListJson as LinesMap

    const stationRecords = Object.entries(stationsData).map(([id, data]) => ({
        id,
        name: data.name,
        lat: data.coordinates.latitude,
        lng: data.coordinates.longitude,
    }))

    await db.insert(stations).values(stationRecords).onConflictDoNothing()

    const lineRecords = Object.keys(linesData).map((id) => ({
        id,
        name: id,
    }))

    await db.insert(lines).values(lineRecords).onConflictDoNothing()

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
}

export const seedReports = async (
    db: DbConnection,
    {
        count = 1000,
        seed = 420,
        clearExistingReports = true,
    }: { count?: number; seed?: number; clearExistingReports?: boolean } = {}
) => {
    const stationsData = stationsListJson as StationsMap
    const linesData = linesListJson as LinesMap

    const randomFloat = createDeterministicRandom(seed)

    const allStationIds = Object.keys(stationsData)
    const allLineEntries = Object.entries(linesData)
    const lineEntriesWithAtLeastThreeStations = allLineEntries.filter(([, stationIds]) => stationIds.length >= 3)

    if (allStationIds.length === 0) throw new Error('No stations available for report seeding')
    if (allLineEntries.length === 0) throw new Error('No lines available for report seeding')
    if (lineEntriesWithAtLeastThreeStations.length === 0) {
        throw new Error('No line with at least 3 stations available for report seeding')
    }

    const stationAndLineCount = Math.floor(count * 0.5)
    const stationOnlyCount = Math.floor(count * 0.25)
    const stationLineAndDirectionCount = count - stationAndLineCount - stationOnlyCount

    const sources: Array<(typeof reports)['$inferInsert']['source']> = ['web_app', 'mobile_app', 'mini_app', 'telegram']

    const makeRandomTimestamp = () => {
        const daysBack = Math.floor(randomFloat() * 30)
        const minutesBack = Math.floor(randomFloat() * 24 * 60)
        return new Date(Date.now() - (daysBack * 24 * 60 + minutesBack) * 60 * 1000)
    }

    const reportRows: Array<(typeof reports)['$inferInsert']> = []

    for (let i = 0; i < stationAndLineCount; i++) {
        const [lineId, stationIds] = pickOne(allLineEntries, randomFloat)
        reportRows.push({
            stationId: pickOne(stationIds, randomFloat),
            lineId,
            source: pickOne(sources, randomFloat),
            timestamp: makeRandomTimestamp(),
        })
    }

    for (let i = 0; i < stationOnlyCount; i++) {
        reportRows.push({
            stationId: pickOne(allStationIds, randomFloat),
            source: pickOne(sources, randomFloat),
            timestamp: makeRandomTimestamp(),
        })
    }

    for (let i = 0; i < stationLineAndDirectionCount; i++) {
        const [lineId, stationIds] = pickOne(lineEntriesWithAtLeastThreeStations, randomFloat)

        // Pick a non-terminal station so direction is always a terminal station and never equals stationId
        const stationIndex = 1 + Math.floor(randomFloat() * (stationIds.length - 2))
        const stationId = stationIds[stationIndex]!

        const firstStationId = stationIds[0]!
        const lastStationId = stationIds[stationIds.length - 1]!

        const directionId = stationIndex < stationIds.length / 2 ? lastStationId : firstStationId

        reportRows.push({
            stationId,
            lineId,
            directionId,
            source: pickOne(sources, randomFloat),
            timestamp: makeRandomTimestamp(),
        })
    }

    if (clearExistingReports) {
        await db.delete(reports)
    }

    await db.insert(reports).values(reportRows)
}
