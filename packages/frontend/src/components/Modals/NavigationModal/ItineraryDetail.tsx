import React from 'react'
import { Itinerary } from 'src/utils/types'
interface ItineraryDetailProps {
    itinerary: Itinerary
    className?: string
    children?: React.ReactNode
}

const ItineraryDetail: React.FC<ItineraryDetailProps> = ({ itinerary, className, children }) => {
    return (
        <div className={`info-popup modal ${className}`}>
            {children}
            <h1>Details</h1>
        </div>
    )
}

export default ItineraryDetail
