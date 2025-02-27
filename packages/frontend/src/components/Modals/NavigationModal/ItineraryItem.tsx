import { Line } from 'src/components/Miscellaneous/Line/Line'
import { Itinerary, Leg } from 'src/utils/types'
import { formatLocalTime } from 'src/utils/dateUtils'

const WALK_ICON = `${process.env.PUBLIC_URL}/icons/walking-svgrepo-com.svg`

interface ItineraryItemProps {
    itinerary: Itinerary
    onClick: () => void
}

export const ItineraryItem: React.FC<ItineraryItemProps> = ({ itinerary, onClick }) => {
    return (
        <div className={`route-option`} onClick={onClick}>
            <div className="route-header">
                <div className="route-time">
                    <span className="time">
                        {formatLocalTime(itinerary.startTime)} - {formatLocalTime(itinerary.endTime)}
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
