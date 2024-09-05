import React, { useCallback, useEffect } from 'react'
import { Marker } from 'react-map-gl/maplibre'

import { watchPosition } from '../../../../../utils/mapUtils'
import { useLocation } from '../../../../../contexts/LocationContext'

import './LocationMarker.css'

interface LocationMarkerProps {
    userPosition: { lng: number; lat: number } | null
}

const LocationMarker: React.FC<LocationMarkerProps> = ({ userPosition }) => {
    const { setUserPosition, openAskForLocation } = useLocation()

    const fetchPosition = useCallback(async () => {
        const stopWatching = await watchPosition(setUserPosition, openAskForLocation)
        return () => stopWatching()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setUserPosition])

    useEffect(() => {
        fetchPosition()
    }, [fetchPosition])

    return (
        <div data-testid="location-marker">
            {userPosition && (
                <Marker className="location-marker" latitude={userPosition.lat} longitude={userPosition.lng}>
                    <span></span>
                </Marker>
            )}
        </div>
    )
}

export default LocationMarker
