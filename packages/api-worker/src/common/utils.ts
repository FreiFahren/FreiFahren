import type { Stations, StationId } from '../modules/transit/types'

const lookupStation = (
    stations: Stations,
    stationId: StationId | null | undefined
): Stations[StationId] | undefined => {
    if (stationId === null || stationId === undefined) return undefined
    if (!Object.prototype.hasOwnProperty.call(stations, stationId)) return undefined
    return stations[stationId]
}

export { lookupStation }
