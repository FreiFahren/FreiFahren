import type { DbConnection } from '../index'
import { lines, lineStations } from '../schema/lines'
import { segments } from '../schema/segments'
import { stations } from '../schema/stations'

import linesListJson from './LinesList.json'
import segmentsJson from './segments.json'
import stationsListJson from './StationsList.json'

interface SegmentFeature {
    properties: { sid: string; line_color: string }
    geometry: { coordinates: [number, number][] }
}

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

    const segmentRecords = (segmentsJson.features as SegmentFeature[]).map((feature) => {
        const [lineId, stationPart] = feature.properties.sid.split('.')
        const [fromStationId, toStationId] = stationPart.split(':')
        const position = (linesData[lineId] ?? []).indexOf(fromStationId)
        return {
            lineId,
            fromStationId,
            toStationId,
            position,
            color: feature.properties.line_color,
            coordinates: feature.geometry.coordinates as [number, number][],
        }
    })

    await db.insert(segments).values(segmentRecords).onConflictDoNothing()
}
