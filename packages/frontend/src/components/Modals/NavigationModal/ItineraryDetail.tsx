import React from 'react'
import { useTranslation } from 'react-i18next'
import { Line } from 'src/components/Miscellaneous/Line/Line'
import { getLineColor } from 'src/hooks/getLineColor'
import { formatDuration, formatLocalTime } from 'src/utils/dateUtils'
import { Itinerary, Leg } from 'src/utils/types'

interface ItineraryDetailProps {
    itinerary: Itinerary
    className?: string
    onBack?: () => void
    onSaveRoute?: (route: Itinerary) => void
    onRemoveRoute?: () => void
    isSaved?: boolean
}

const ItineraryDetail: React.FC<ItineraryDetailProps> = ({ 
    itinerary, 
    className, 
    onBack,
    onSaveRoute,
    onRemoveRoute,
    isSaved = false
}) => {
    const { t } = useTranslation()
    const durationMinutes = Math.round(itinerary.duration / 60)
    const durationText = `(${formatDuration(durationMinutes)})`

    const handleBack = (): void => {
        if (onBack) {
            onBack()
        }
    }

    const renderLeg = (leg: Leg, index: number, isLast: boolean) => {
        const isWalking = leg.mode.toLowerCase() === 'walk'

        return (
            <div key={index} className="itinerary-leg">
                <div className="itinerary-step">
                    <div className="step-time">
                        <span>{formatLocalTime(leg.startTime)}</span>
                    </div>
                    <div
                        className={`step-details ${isWalking ? 'walking-step' : ''}`}
                        style={
                            !isWalking && leg.routeShortName !== undefined && leg.routeShortName !== ''
                                ? { borderLeftColor: getLineColor(leg.routeShortName) }
                                : undefined
                        }
                    >
                        <div className="step-location transfer-station">
                            <div className="timeline-marker" />
                            <p>{leg.from.name}</p>
                        </div>
                        {!isWalking ? (
                            <>
                                <div className="transit-info">
                                    <Line line={leg.routeShortName ?? ''} />
                                    <div className="transit-direction">
                                        <span>{leg.to.name}</span>
                                    </div>
                                </div>
                                {leg.intermediateStops && leg.intermediateStops.length > 0 ? (
                                    <div className="stops-info">
                                        <span className="stops-count">
                                            {leg.intermediateStops.length} {t('NavigationModal.stops')}
                                        </span>
                                    </div>
                                ) : null}
                            </>
                        ) : null}
                    </div>
                </div>

                {isLast ? (
                    <div className="itinerary-step">
                        <div className="step-time">
                            <span>{formatLocalTime(leg.endTime)}</span>
                        </div>
                        <div className="step-details">
                            <div className="step-location">
                                <div className="timeline-marker" />
                                <p>{leg.to.name}</p>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        )
    }

    return (
        <div className={`navigation-detail modal container ${className}`}>
            <div className="itinerary-header">
                <div className="route-header">
                    <div className="route-locations">
                        {onBack ? (
                            <button
                                type="button"
                                className="back-button"
                                onClick={handleBack}
                                aria-label={t('NavigationModal.back')}
                            >
                                <img src="/icons/right-arrow-svgrepo-com.svg" alt="Back" className="back-icon" />
                            </button>
                        ) : null}
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

            {itinerary.calculatedRisk !== undefined ? (
                <div className="route-risk">
                    <div
                        className="risk-indicator"
                        style={{
                            width: `${Math.max(10, 100 - itinerary.calculatedRisk * 100)}%`,
                            backgroundColor: `hsl(${120 - itinerary.calculatedRisk * 120}, 70%, 60%)`,
                        }}
                    />
                    <div className="risk-text">
                        <span>
                            {t('NavigationModal.safetyScore')}: {Math.round((1 - itinerary.calculatedRisk) * 100)}%
                        </span>
                    </div>
                </div>
            ) : null}
            
            {/* Save/Remove Route buttons */}
            <div className="route-actions">
                {!isSaved && onSaveRoute ? (
                    <button 
                        type="button" 
                        className="button-gray" 
                        onClick={() => onSaveRoute(itinerary)}
                    >
                        <span>{t('NavigationModal.saveRoute')}</span>
                    </button>
                ) : null}
                {isSaved && onRemoveRoute ? (
                    <button 
                        type="button" 
                        className="button-gray" 
                        onClick={() => onRemoveRoute()}
                    >
                        <span>{t('NavigationModal.removeRoute')}</span>
                    </button>
                ) : null}
            </div>
        </div>
    )
}

export default ItineraryDetail
