import { Line } from 'src/components/Miscellaneous/Line/Line'
import { Itinerary, Leg } from 'src/utils/types'

const WALK_ICON = `${process.env.PUBLIC_URL}/icons/walking-svgrepo-com.svg`

interface ItineraryItemProps {
    itinerary: Itinerary
}

export const ItineraryItem: React.FC<ItineraryItemProps> = ({ itinerary }) => {
    return (
        <div className={`route-option`}>
            <div className="route-header">
                <div className="route-time">
                    <span className="time">
                        {itinerary.startTime.slice(11, 16)} - {itinerary.endTime.slice(11, 16)}
                    </span>
                    <span className="duration">{Math.floor((itinerary.duration / 60) % 60)} min</span>
                </div>
                <div className="route-info">
                    <div className="route-lines">
                        {itinerary.legs.map((leg: Leg, index: number) => (
                            <span key={index}>
                                {leg.mode === 'WALK' ? (
                                    <img src={WALK_ICON} alt="Walking" className="walk-icon" width="15" height="15" />
                                ) : (
                                    leg.routeShortName && <Line line={leg.routeShortName} />
                                )}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
