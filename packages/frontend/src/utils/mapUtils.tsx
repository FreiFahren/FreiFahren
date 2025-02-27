import { StationProperty } from './types'

export const deg2rad = (deg: number): number => deg * (Math.PI / 180)
/**
 * Calculates the distance between two geographical points using the Haversine formula.
 *
 * @param {number} lat1 - The latitude of the first point in decimal degrees.
 * @param {number} lon1 - The longitude of the first point in decimal degrees.
 * @param {number} lat2 - The latitude of the second point in decimal degrees.
 * @param {number} lon2 - The longitude of the second point in decimal degrees.
 * @returns {number} The distance between the two points in kilometers.
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371 // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1)
    const dLon = deg2rad(lon2 - lon1)
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c // Distance in km

    return distance
}

/**
 * Subscribes to user's geolocation changes and executes callback functions based on the result.
 * @param {Function} onPositionChanged Callback that handles position data.
 * @param {Function} openAskForLocation Callback that handles failures in obtaining geolocation.
 * @param {Object} options Configuration options for geolocation. Default values are:
 * {
 *    enableHighAccuracy: true,
 *    timeout: 15 seconds,
 *    maximumAge: 15 seconds
 * }
 * @param {number} distanceThreshold The distance in meters that the user has to move before the location is updated.
 * @returns {Function} Unsubscribe function to stop watching position.
 */
export const watchPosition = async (
    onPositionChanged: (position: { lng: number; lat: number } | null) => void,
    options: object = {
        enableHighAccuracy: true,
        timeout: 10 * 1000,
        maximumAge: 15 * 1000,
    },
    distanceThreshold: number = 50
): Promise<() => void> => {
    let lastPosition: { lng: number; lat: number } | null = null
    const watchId = navigator.geolocation.watchPosition(
        (position) => {
            const newPosition = {
                lng: position.coords.longitude,
                lat: position.coords.latitude,
            }

            if (lastPosition) {
                const distance =
                    calculateDistance(lastPosition.lat, lastPosition.lng, newPosition.lat, newPosition.lng) * 1000 // Convert km to meters

                if (distance >= distanceThreshold) {
                    onPositionChanged(newPosition)
                    lastPosition = newPosition
                }
            } else {
                // First position update
                onPositionChanged(newPosition)
                lastPosition = newPosition
            }
        },
        (error) => {
            onPositionChanged(null)
        },
        options
    )

    return () => navigator.geolocation.clearWatch(watchId)
}

export const convertStationsToGeoJSON = (stationsData: { [key: string]: StationProperty }) => ({
    type: 'FeatureCollection',
    features: Object.keys(stationsData).map((key) => ({
        type: 'Feature',
        properties: {
            name: stationsData[key].name,
            lines: stationsData[key].lines,
        },
        geometry: {
            type: 'Point',
            coordinates: [stationsData[key].coordinates.longitude, stationsData[key].coordinates.latitude],
        },
    })),
})
