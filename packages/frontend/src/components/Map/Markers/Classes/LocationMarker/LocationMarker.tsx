import './LocationMarker.css'

import { useCallback, useEffect } from 'react'
import { Marker } from 'react-map-gl/maplibre'

import { useLocation } from '../../../../../contexts/LocationContext'
import { watchPosition } from '../../../../../utils/mapUtils'

interface LocationMarkerProps {
    userPosition: { lng: number; lat: number } | null
}

export const LocationMarker = ({ userPosition }: LocationMarkerProps) => {
    const { setUserPosition } = useLocation()

    const fetchPosition = useCallback(async () => {
        const stopWatching = await watchPosition(setUserPosition)

        return () => stopWatching()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setUserPosition])

    useEffect(() => {
        fetchPosition().catch((error) => {
            // eslint-disable-next-line no-console
            console.error('Error fetching user position', error)
        })
    }, [fetchPosition])

    return (
        <div data-testid="location-marker">
            {userPosition && (
                <Marker className="location-marker" latitude={userPosition.lat} longitude={userPosition.lng}>
                    <span />
                </Marker>
            )}
        </div>
    )
}
