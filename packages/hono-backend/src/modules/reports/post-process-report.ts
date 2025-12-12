import { lookupStation } from '../../common/utils'
import { InsertReport } from '../../db'
import { LineId, StationId, Stations } from '../transit/types'

type RawReport = Omit<InsertReport, 'stationId'> & {
    stationId?: StationId | undefined
}

type StationReferenceField = 'stationId' | 'directionId'

/**
 * Pipe a value through a series of functions
 * @param value - The value to pipe through the functions
 * @param fns - The functions to pipe through
 * @returns The final value
 */
const pipe = <T>(value: T, ...fns: ((arg: T) => T)[]) => fns.reduce((acc, fn) => fn(acc), value)

const isStationOnLine = (
    stations: Stations,
    lineId: LineId | null | undefined,
    stationId: StationId | null | undefined
): boolean | undefined => {
    if (lineId === null || lineId === undefined) return undefined
    if (stationId === null || stationId === undefined) return undefined

    const station = lookupStation(stations, stationId)
    if (station === undefined) return false

    return station.lines.includes(lineId)
}

const clearStationReferenceIfNotOnLine =
    (stations: Stations, stationReferenceField: StationReferenceField) =>
    (reportData: RawReport): RawReport => {
        const stationId = reportData[stationReferenceField]
        const stationOnLine = isStationOnLine(stations, reportData.lineId, stationId)

        if (stationOnLine === false) {
            return { ...reportData, [stationReferenceField]: undefined }
        }

        return reportData
    }

const assignLineIfSingleOption =
    (stations: Stations) =>
    (reportData: RawReport): RawReport => {
        if (reportData.lineId !== null && reportData.lineId !== undefined) return reportData

        const getLineFromStation = (stations: Stations, stationId: StationId | null | undefined) => {
            if (stationId === null || stationId === undefined) return undefined
            const station = lookupStation(stations, stationId)
            if (station === undefined) return undefined
            return station.lines.length === 1 ? station.lines[0] : undefined
        }

        const lineId =
            getLineFromStation(stations, reportData.stationId) ?? getLineFromStation(stations, reportData.directionId)

        if (lineId !== undefined) {
            return { ...reportData, lineId }
        }

        return reportData
    }

export { assignLineIfSingleOption, clearStationReferenceIfNotOnLine, isStationOnLine, pipe, RawReport }
