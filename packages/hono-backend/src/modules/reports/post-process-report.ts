import { lookupStation } from '../../common/utils'
import { InsertReport } from '../../db'
import { LineId, Lines, StationId, Stations } from '../transit/types'

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

// TODO: Use a stochastic approach to guess the station
const guessStation = (reportData: RawReport): RawReport => {
    if (reportData.stationId === undefined) {
        return { ...reportData, stationId: 'SUM-n30731497' }
    }

    return reportData
}

const correctDirectionIfImplied =
    (lines: Lines) =>
    (reportData: RawReport): RawReport => {
        if (reportData.lineId === null || reportData.lineId === undefined) return reportData
        if (reportData.stationId === undefined) return reportData
        if (reportData.directionId === null || reportData.directionId === undefined) return reportData

        const stationsOnLine = lines[reportData.lineId]
        if (stationsOnLine.length < 2) return reportData

        const firstStationOnLine = stationsOnLine[0]
        const lastStationOnLine = stationsOnLine[stationsOnLine.length - 1]

        if (reportData.directionId === firstStationOnLine || reportData.directionId === lastStationOnLine) {
            return reportData
        }

        const stationIndex = stationsOnLine.indexOf(reportData.stationId)
        const directionIndex = stationsOnLine.indexOf(reportData.directionId)

        if (stationIndex === -1 || directionIndex === -1) return reportData
        if (stationIndex === directionIndex) return reportData

        const impliedTerminalDirectionId = stationIndex < directionIndex ? lastStationOnLine : firstStationOnLine

        if (impliedTerminalDirectionId === reportData.directionId) return reportData

        return { ...reportData, directionId: impliedTerminalDirectionId }
    }

const determineLineBasedOnStationAndDirection =
    (stations: Stations) =>
    (reportData: RawReport): RawReport => {
        if (reportData.lineId !== null && reportData.lineId !== undefined) return reportData

        const station = lookupStation(stations, reportData.stationId)
        const direction = lookupStation(stations, reportData.directionId)

        if (station === undefined || direction === undefined) return reportData

        const directionLines = new Set(direction.lines)
        const sharedLines = station.lines.filter((lineId) => directionLines.has(lineId))

        if (sharedLines.length === 1) {
            return { ...reportData, lineId: sharedLines[0] }
        }

        return reportData
    }

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

export {
    assignLineIfSingleOption,
    clearStationReferenceIfNotOnLine,
    determineLineBasedOnStationAndDirection,
    correctDirectionIfImplied,
    guessStation,
    isStationOnLine,
    pipe,
    RawReport,
}
