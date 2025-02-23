import { Line } from 'src/components/Miscellaneous/Line/Line'
import { Itinerary, Leg } from 'src/utils/types'

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
                        {itinerary.legs.map(
                            (leg: Leg, index: number) =>
                                leg.routeShortName && <Line key={index} line={leg.routeShortName} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
