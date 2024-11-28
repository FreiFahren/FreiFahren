import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { sendAnalyticsEvent } from 'src/utils/analytics'

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

export const LocationProvider = ({ children }: PropsWithChildren) => {
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
        watchPosition(setUserPosition).catch((error) => {
            // eslint-disable-next-line no-console
            console.error('Failed to initialize location tracking:', error)
            throw error
        })
    }, [setUserPosition])

    const context = useMemo(() => ({ userPosition, setUserPosition, initializeLocationTracking }), [initializeLocationTracking, setUserPosition, userPosition])

    return (
        <LocationContext.Provider value={context}>
            {children}
        </LocationContext.Provider>
    )
}
