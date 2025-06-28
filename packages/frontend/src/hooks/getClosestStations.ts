import { calculateDistance } from 'src/utils/mapUtils'
import { Station } from 'src/utils/types'

export const getClosestStations = (
    numberOfStations: number,
    stationsList: Station[],
    location: { lat: number; lng: number }
): Station[] => {
    const distances = stationsList.map((station) => {
        const distance = calculateDistance(
            location.lat,
            location.lng,
            station.coordinates.latitude,
            station.coordinates.longitude
        )

        return { station, distance }
    })

    distances.sort((a, b) => a.distance - b.distance)
    return distances.slice(0, numberOfStations).map((entry) => entry.station)
}
