import React, { createContext, useState, useContext, useCallback, useRef } from 'react'
import { watchPosition } from '../utils/mapUtils'
import { sendAnalyticsEvent } from 'src/utils/analytics'

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
    const [userPosition, setUserPositionState] = useState<{ lng: number; lat: number } | null>(null)
    const hasLocationEventBeenSentRef = useRef(false) // avoid sending the location event on every render

    const setUserPosition = useCallback((position: { lng: number; lat: number } | null) => {
        setUserPositionState(position)
        if (position && !hasLocationEventBeenSentRef.current) {
            sendAnalyticsEvent('User Position has been set')
            hasLocationEventBeenSentRef.current = true
        }
    }, [])

    const initializeLocationTracking = useCallback(() => {
        watchPosition(setUserPosition)
    }, [setUserPosition])

    return (
        <LocationContext.Provider
            value={{
                userPosition,
                setUserPosition,
                initializeLocationTracking,
            }}
        >
            {children}
        </LocationContext.Provider>
    )
}
