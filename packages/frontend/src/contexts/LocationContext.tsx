import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

import { sendAnalyticsEvent } from '../hooks/useAnalytics'
import { watchPosition } from '../utils/mapUtils'

// this will be replaced with sentry handling
const handleError = (error: unknown, context: string) => {
    if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error(`Error in ${context}:`, error)
    }
}

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
    const [userPositionState, setUserPositionState] = useState<{ lng: number; lat: number } | null>(null)
    const hasLocationEventBeenSentRef = useRef(false)

    const setUserPosition = useCallback((position: { lng: number; lat: number } | null) => {
        setUserPositionState(position)
        if (position && !hasLocationEventBeenSentRef.current) {
            sendAnalyticsEvent('User Position has been set').catch((error) => handleError(error, 'sendAnalyticsEvent'))
            hasLocationEventBeenSentRef.current = true
        }
    }, [])

    const initializeLocationTracking = useCallback(() => {
        watchPosition(setUserPosition).catch((error) => handleError(error, 'watchPosition'))
    }, [setUserPosition])

    const contextValue = useMemo(
        () => ({
            userPosition: userPositionState,
            setUserPosition,
            initializeLocationTracking,
        }),
        [userPositionState, setUserPosition, initializeLocationTracking]
    )

    return <LocationContext.Provider value={contextValue}>{children}</LocationContext.Provider>
}
