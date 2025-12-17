import { createContext, ReactNode, useContext, useRef } from 'react'

import { createTracker, Tracker } from './index'

type TrackingContextValue = Tracker
const TrackingContext = createContext<TrackingContextValue | null>(null)

export const useTracking = () => {
    const context = useContext(TrackingContext)

    if (!context) {
        throw new Error('useTracking must be used within TrackingProvider')
    }

    return context
}

type TrackingProviderProps = {
    children: ReactNode
}

export const TrackingProvider = ({ children }: TrackingProviderProps) => {
    const trackerRef = useRef(createTracker())

    return <TrackingContext.Provider value={trackerRef.current}>{children}</TrackingContext.Provider>
}
