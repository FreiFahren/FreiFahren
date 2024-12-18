import { useState, useRef } from 'react'
import { getStationDistance } from '../utils/dbUtils'
import { getNearestStation } from '../utils/mapUtils'
import { StationList } from '../utils/dbUtils'

interface UseStationDistanceResult {
    distance: number | null
    isLoading: boolean
    shouldShowSkeleton: boolean
}

/**
 * A hook that calculates the distance between a user's nearest station and a target station.
 * This hook directly makes an API call without using useEffect to avoid unnecessary re-renders.
 * It manages loading states and skeleton UI visibility for a better user experience.
 *
 * @param stationId - The unique identifier of the target station
 * @param allStations - A record of all available stations and their properties
 * @param userLat - The user's current latitude (optional)
 * @param userLng - The user's current longitude (optional)
 * @returns {UseStationDistanceResult} An object containing:
 *  - distance: The calculated distance in minutes (null if not available)
 *  - isLoading: Whether the distance is currently being fetched
 *  - shouldShowSkeleton: Whether the skeleton UI should be displayed
 *
 * @example
 * ```tsx
 * const MyComponent = ({ stationId, allStations, userLocation }) => {
 *   const { distance, isLoading, shouldShowSkeleton } = useStationDistance(
 *     stationId,
 *     allStations,
 *     userLocation?.lat,
 *     userLocation?.lng
 *   )
 *
 *   if (isLoading && shouldShowSkeleton) {
 *     return <SkeletonLoader />
 *   }
 *
 *   return <div>Distance: {distance} minutes</div>
 * }
 * ```
 */
export const useStationDistance = (
    stationId: string,
    allStations: StationList,
    userLat?: number,
    userLng?: number
): UseStationDistanceResult => {
    const [distance, setDistance] = useState<number | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [shouldShowSkeleton, setShouldShowSkeleton] = useState(true)
    const fetchingRef = useRef(false)
    const prevStationIdRef = useRef(stationId)

    // Only show skeleton if the station changes
    if (stationId !== prevStationIdRef.current) {
        setShouldShowSkeleton(true)
        setDistance(null)
        prevStationIdRef.current = stationId
    }

    // Fetch distance if we have all required data and aren't already fetching
    if (userLat && userLng && stationId && !fetchingRef.current) {
        fetchingRef.current = true
        setIsLoading(true)

        const userStation = getNearestStation(allStations, userLat, userLng)
        if (userStation) {
            getStationDistance(userStation.key, stationId)
                .then((newDistance) => {
                    setDistance(newDistance)
                    setIsLoading(false)
                    // Avoid showing skeleton when position changes due to watchPosition
                    setShouldShowSkeleton(false)
                })
                .catch((error) => {
                    console.error('Error fetching distance:', error)
                    setDistance(null)
                    setIsLoading(false)
                })
                .finally(() => {
                    fetchingRef.current = false
                })
        } else {
            setIsLoading(false)
            fetchingRef.current = false
        }
    }

    return {
        distance,
        isLoading,
        shouldShowSkeleton,
    }
}
