import { calculateDistance } from 'src/utils/mapUtils'
import { StationList, StationProperty } from 'src/utils/types'

export const getClosestStations = (
    numberOfStations: number,
    stationsList: StationList,
    location: { lat: number; lng: number }
): { [key: string]: StationProperty }[] => {
    const distances = Object.entries(stationsList).map(([station, stationData]) => {
        const distance = calculateDistance(
            location.lat,
            location.lng,
            stationData.coordinates.latitude,
            stationData.coordinates.longitude
        )

        return { station, stationData, distance }
    })

    distances.sort((a, b) => a.distance - b.distance)
    return distances.slice(0, numberOfStations).map((entry) => ({ [entry.station]: entry.stationData }))
}
