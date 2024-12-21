import './LocationMarker.css'

import React, { useCallback, useEffect } from 'react'
import { Marker } from 'react-map-gl/maplibre'

import { useLocation } from '../../../../../contexts/LocationContext'
import { watchPosition } from '../../../../../utils/mapUtils'

interface LocationMarkerProps {
    userPosition: { lng: number; lat: number } | null
}

const LocationMarker: React.FC<LocationMarkerProps> = ({ userPosition }) => {
    const { setUserPosition } = useLocation()

    const fetchPosition = useCallback(async () => {
        const stopWatching = await watchPosition(setUserPosition)

        return () => stopWatching()
    }, [setUserPosition])

    useEffect(() => {
        fetchPosition().catch((error) => {
            // fix this later with sentry
            // eslint-disable-next-line no-console
            console.error('Error fetching position', error)
        })
    }, [fetchPosition])

    return (
        <div data-testid="location-marker">
            {userPosition ? <Marker className="location-marker" latitude={userPosition.lat} longitude={userPosition.lng}>
                    <span />
                </Marker> : null}
        </div>
    )
}

export { LocationMarker }
