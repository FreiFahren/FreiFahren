import { InsertReport } from '../../db'
import { StationId, Stations } from '../transit/types'

type RawReport = Omit<InsertReport, 'stationId'> & {
    stationId?: StationId | undefined
}

/**
 * Pipe a value through a series of functions
 * @param value - The value to pipe through the functions
 * @param fns - The functions to pipe through
 * @returns The final value
 */
const pipe = <T>(value: T, ...fns: ((arg: T) => T)[]) => fns.reduce((acc, fn) => fn(acc), value)

// Todo: Unit test this function
const assignLineIfSingleOption =
    (stations: Stations) =>
    (reportData: RawReport): RawReport => {
        if (reportData.lineId !== null) return reportData

        const getLineFromStation = (stations: Stations, stationId: StationId | null | undefined) => {
            if (stationId === null || stationId === undefined) return undefined
            const station = stations[stationId]
            return station.lines.length === 1 ? station.lines[0] : undefined
        }

        const lineId =
            getLineFromStation(stations, reportData.stationId) ?? getLineFromStation(stations, reportData.directionId)

        if (lineId !== undefined) {
            return { ...reportData, lineId }
        }

        return reportData
    }

export { assignLineIfSingleOption, pipe, RawReport }
