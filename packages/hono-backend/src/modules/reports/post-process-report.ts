import { DateTime } from 'luxon'

import { AppError } from '../../common/errors'
import { lookupStation } from '../../common/utils'
import { InsertReport } from '../../db'
import { LineId, Lines, StationId, Stations } from '../transit/types'

type RawReport = Omit<InsertReport, 'stationId'> & {
    stationId?: StationId | undefined
}

type StationReferenceField = 'stationId' | 'directionId'

/**
 * Pipe a value through a series of (a)synchronous functions
 * @param value - The value to pipe through the functions
 * @param fns - The functions to pipe through
 * @returns The final resolved value
 */
const pipeAsync = async <T>(value: T, ...fns: Array<(arg: T) => T | Promise<T>>): Promise<T> => {
    let result = value
    for (const fn of fns) {
        result = await fn(result)
    }
    return result
}

const normalizeDayOfWeek = (dayOfWeek: number): number => {
    // Accept both JS-style (0-6, Sunday=0) and Luxon-style (1-7, Monday=1)
    if (!Number.isFinite(dayOfWeek)) return 0
    if (dayOfWeek >= 1 && dayOfWeek <= 7) return dayOfWeek
    if (dayOfWeek >= 0 && dayOfWeek <= 6) return dayOfWeek === 0 ? 7 : dayOfWeek
    return 0
}

const circularDistance = (a: number, b: number, modulus: number): number => {
    const forward = (a - b + modulus) % modulus
    const backward = (b - a + modulus) % modulus
    return Math.min(forward, backward)
}

const getMostCommonStationId = (
    rows: Array<{ stationId: StationId; timestamp: Date }>,
    {
        hour,
        dayOfWeek,
        hourWindow,
        dayWindow,
    }: { hour: number; dayOfWeek: number; hourWindow: number; dayWindow: number }
): StationId | undefined => {
    const normalizedDayOfWeek = normalizeDayOfWeek(dayOfWeek)
    if (normalizedDayOfWeek === 0) return undefined
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return undefined

    const counts = new Map<StationId, number>()

    for (const row of rows) {
        const dateTime = DateTime.fromJSDate(row.timestamp, { zone: 'utc' })
        const rowHour = dateTime.hour
        const rowDayOfWeek = dateTime.weekday // 1-7

        const hourDifference = circularDistance(rowHour, hour, 24)
        const dayDifference = circularDistance(rowDayOfWeek, normalizedDayOfWeek, 7)

        if (hourDifference > hourWindow) continue
        if (dayDifference > dayWindow) continue

        counts.set(row.stationId, (counts.get(row.stationId) ?? 0) + 1)
    }

    let bestStationId: StationId | undefined
    let bestCount = -1

    counts.forEach((count, stationId) => {
        if (count > bestCount) {
            bestStationId = stationId
            bestCount = count
            return
        }

        if (count === bestCount && bestStationId !== undefined && stationId < bestStationId) {
            bestStationId = stationId
        }
    })

    return bestStationId
}

const guessStation =
    (candidateRows: Array<{ stationId: StationId; timestamp: Date }>) =>
    (hour: number, dayOfWeek: number) =>
    (reportData: RawReport): RawReport => {
        // We do not want to guess the station without a line
        // Otherwise the guess would be too broad and we would end up with a lot of false positives
        if (reportData.stationId !== undefined || reportData.lineId === null || reportData.lineId === undefined)
            return reportData

        const normalizedDayOfWeek = normalizeDayOfWeek(dayOfWeek)
        if (normalizedDayOfWeek === 0) {
            throw new AppError({
                message: 'Cannot infer station because day of week is invalid',
                statusCode: 500,
                internalCode: 'UNKNOWN_ERROR',
                description: `Provided dayOfWeek=${String(dayOfWeek)}`,
            })
        }

        const hourIsValid = Number.isInteger(hour) && hour >= 0 && hour <= 23
        if (!hourIsValid) {
            throw new AppError({
                message: 'Cannot infer station because hour is invalid',
                statusCode: 500,
                internalCode: 'UNKNOWN_ERROR',
                description: `Provided hour=${String(hour)}`,
            })
        }

        // Expand search window until we find at least one matching station.
        // Day window: 0..3 covers the full week (max distance is 3).
        // Hour window: 0..12 covers the full day (max distance is 12).
        for (let dayWindow = 0; dayWindow <= 3; dayWindow++) {
            for (let hourWindow = 0; hourWindow <= 12; hourWindow++) {
                const stationId = getMostCommonStationId(candidateRows, {
                    hour,
                    dayOfWeek: normalizedDayOfWeek,
                    hourWindow,
                    dayWindow,
                })
                if (stationId !== undefined) {
                    return { ...reportData, stationId }
                }
            }
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

const clearDirectionIfStationAndDirectionAreTheSame = (reportData: RawReport): RawReport => {
    if (reportData.stationId === reportData.directionId) {
        return { ...reportData, directionId: undefined }
    }

    return reportData
}

const ifDirectionPresentWithoutLineClearDirection = (reportData: RawReport): RawReport => {
    if (
        reportData.directionId !== null &&
        reportData.directionId !== undefined &&
        (reportData.lineId === null || reportData.lineId === undefined)
    ) {
        return { ...reportData, directionId: undefined }
    }

    return reportData
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
    ifDirectionPresentWithoutLineClearDirection,
    guessStation,
    clearDirectionIfStationAndDirectionAreTheSame,
    isStationOnLine,
    pipeAsync,
    RawReport,
}
