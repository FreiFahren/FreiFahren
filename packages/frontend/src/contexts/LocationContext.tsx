import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { sendAnalyticsEvent } from 'src/hooks/useAnalytics'

import { watchPosition } from '../utils/mapUtils'

interface LocationContextType {
    userPosition: { lng: number; lat: number } | null
    setUserPosition: (position: { lng: number; lat: number } | null) => void
    initializeLocationTracking: () => void
}

const LocationContext = createContext<LocationContextType | undefined>(undefined)

export const useLocation = () => {
    const context = useContext(LocationContext)

    if (!context) {
        throw new Error('useLocation must be used within a LocationProvider')
    }
    return context
}

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [userPosition, setUserPosition] = useState<{ lng: number; lat: number } | null>(null)
    const hasLocationEventBeenSentRef = useRef(false) // avoid sending the location event on every render

    const setUserPositionState = useCallback((position: { lng: number; lat: number } | null) => {
        setUserPosition(position)
        if (position && !hasLocationEventBeenSentRef.current) {
            sendAnalyticsEvent('User Position has been set').catch((error) => {
                // fix later with sentry
                // eslint-disable-next-line no-console
                console.error('Error sending analytics event:', error)
            })
            hasLocationEventBeenSentRef.current = true
        }
    }, [])

    const initializeLocationTracking = useCallback(() => {
        watchPosition(setUserPositionState).catch((error) => {
            // fix later with sentry
            // eslint-disable-next-line no-console
            console.error('Error watching position:', error)
        })
    }, [setUserPositionState])

    return (
        <LocationContext.Provider
            value={useMemo(
                () => ({
                    userPosition,
                    setUserPosition,
                    initializeLocationTracking,
                }),
                [userPosition, setUserPosition, initializeLocationTracking]
            )}
        >
            {children}
        </LocationContext.Provider>
    )
}
