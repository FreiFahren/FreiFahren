import React from 'react'
import { Itinerary, Leg } from 'src/utils/types'
import { useTranslation } from 'react-i18next'
import { formatLocalTime, formatDuration } from 'src/utils/dateUtils'
import { Line } from 'src/components/Miscellaneous/Line/Line'
import { getLineColor } from 'src/hooks/getLineColor'

interface ItineraryDetailProps {
    itinerary: Itinerary
    className?: string
}

const ItineraryDetail: React.FC<ItineraryDetailProps> = ({ itinerary, className }) => {
    const { t } = useTranslation()
    const durationMinutes = Math.round(itinerary.duration / 60)
    const durationText = `(${formatDuration(durationMinutes)})`

    const renderLeg = (leg: Leg, index: number, isLast: boolean) => {
        return (
            <div key={index} className="itinerary-leg">
                {index === 0 && (
                    <div className="itinerary-step">
                        <div className="step-time">
                            <span>{formatLocalTime(leg.startTime)}</span>
                        </div>
                        <div className="step-timeline">
                            <div className="timeline-marker"></div>
                        </div>
                        <div className="step-details">
                            <div className="step-location">
                                <p>{leg.from.name}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="itinerary-step">
                    <div className="step-time">
                        <span>{formatLocalTime(leg.startTime)}</span>
                    </div>
                    <div className="step-timeline">
                        <div
                            className="timeline-transit"
                            style={{ backgroundColor: getLineColor(leg.routeShortName || '') }}
                        ></div>
                    </div>
                    <div className="step-details">
                        <div className="transit-info">
                            <Line line={leg.routeShortName || ''} />
                            <div className="transit-direction">
                                <span>{leg.headsign || leg.to.name}</span>
                            </div>
                        </div>
                        {leg.intermediateStops && leg.intermediateStops.length > 0 && (
                            <div className="stops-info">
                                <span className="stops-count">
                                    {leg.intermediateStops.length} {t('NavigationModal.stops')}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {isLast && (
                    <div className="itinerary-step">
                        <div className="step-time">
                            <span>{formatLocalTime(leg.endTime)}</span>
                        </div>
                        <div className="step-timeline">
                            <div className="timeline-marker"></div>
                        </div>
                        <div className="step-details">
                            <div className="step-location">
                                <p>{leg.to.name}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className={`navigation-detail modal container ${className}`}>
            <div className="itinerary-header">
                <div className="route-header">
                    <div className="route-locations">
                        <div className="origin">
                            <p>
                                {t('NavigationModal.from')} {itinerary.legs[0].from.name}
                            </p>
                        </div>
                        <div className="destination">
                            <p>
                                {t('NavigationModal.to')} {itinerary.legs[itinerary.legs.length - 1].to.name}
                            </p>
                        </div>
                    </div>

                    <div className="route-time">
                        <div className="time-range">
                            <span>
                                {formatLocalTime(itinerary.startTime)} - {formatLocalTime(itinerary.endTime)}
                            </span>
                            <span className="day-duration"> {durationText}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="itinerary-timeline">
                {itinerary.legs.map((leg, index) => renderLeg(leg, index, index === itinerary.legs.length - 1))}
            </div>

            {itinerary.calculatedRisk !== undefined && (
                <div className="route-risk">
                    <div
                        className="risk-indicator"
                        style={{
                            width: `${Math.max(10, 100 - itinerary.calculatedRisk * 100)}%`,
                            backgroundColor: `hsl(${120 - itinerary.calculatedRisk * 120}, 70%, 60%)`,
                        }}
                    ></div>
                    <div className="risk-text">
                        <span>
                            {t('NavigationModal.safetyScore')}: {Math.round((1 - itinerary.calculatedRisk) * 100)}%
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ItineraryDetail
