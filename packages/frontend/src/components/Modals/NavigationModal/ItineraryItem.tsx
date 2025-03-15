import React, { KeyboardEvent } from 'react'
import { Line } from 'src/components/Miscellaneous/Line/Line'
import { formatLocalTime } from 'src/utils/dateUtils'
import { Itinerary, Leg } from 'src/utils/types'

const WALK_ICON = `${process.env.PUBLIC_URL}/icons/walking-svgrepo-com.svg`

interface ItineraryItemProps {
    itinerary: Itinerary
    onClick: () => void
}

export const ItineraryItem: React.FC<ItineraryItemProps> = ({ itinerary, onClick }) => {
    const handleClick = (): void => {
        onClick()
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick()
        }
    }

    return (
        <div
            className="route-option"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label="Select this route"
        >
            <div className="route-header">
                <div className="route-time">
                    <span className="time">
                        {formatLocalTime(itinerary.startTime)} - {formatLocalTime(itinerary.endTime)}
                    </span>
                    <span className="duration">{Math.floor((itinerary.duration / 60) % 60)} min</span>
                </div>
                <div className="route-info">
                    <div className="route-lines">
                        {itinerary.legs.map((leg: Leg) => (
                            <span key={`leg-${leg.from.name}-${leg.to.name}-${leg.startTime}`}>
                                {leg.mode === 'WALK' ? (
                                    <img src={WALK_ICON} alt="Walking" className="walk-icon" width="15" height="15" />
                                ) : (
                                    leg.routeShortName !== undefined &&
                                    leg.routeShortName !== '' && <Line line={leg.routeShortName} />
                                )}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
