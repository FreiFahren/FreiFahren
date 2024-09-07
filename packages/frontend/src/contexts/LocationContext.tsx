import React, { createContext, useState, useContext, useCallback, useRef } from 'react'
import { watchPosition } from '../utils/mapUtils'

interface LocationContextType {
    userPosition: { lng: number; lat: number } | null
    setUserPosition: (position: { lng: number; lat: number } | null) => void
    isAskForLocationOpen: boolean
    openAskForLocation: () => void
    closeAskForLocation: () => void
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
    const [isAskForLocationOpen, setIsAskForLocationOpen] = useState(false)
    const hasAskedForLocationBeenOpenedRef = useRef(false) // avoid overwriting the state with a new value on every render

    // this is to prevent the ask for location modal from opening when the user has already opened it once
    const openAskForLocation = useCallback(() => {
        if (!hasAskedForLocationBeenOpenedRef.current) {
            setIsAskForLocationOpen(true)
            hasAskedForLocationBeenOpenedRef.current = true
        }
    }, [])
    const closeAskForLocation = useCallback(() => setIsAskForLocationOpen(false), [])

    const initializeLocationTracking = useCallback(() => {
        watchPosition(setUserPosition, openAskForLocation)
    }, [openAskForLocation])

    return (
        <LocationContext.Provider
            value={{
                userPosition,
                setUserPosition,
                isAskForLocationOpen,
                openAskForLocation,
                closeAskForLocation,
                initializeLocationTracking,
            }}
        >
            {children}
        </LocationContext.Provider>
    )
}
