import './NavigationModal.css'

import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FeedbackButton from 'src/components/Buttons/FeedbackButton/FeedbackButton'
import { FeedbackForm } from 'src/components/Form/FeedbackForm/FeedbackForm'

import { useNavigation, useStations } from '../../../api/queries'
import { useLocation } from '../../../contexts/LocationContext'
import { getClosestStations } from '../../../hooks/getClosestStations'
import { sendAnalyticsEvent, useTrackComponentView } from '../../../hooks/useAnalytics'
import { useStationSearch } from '../../../hooks/useStationSearch'
import { Itinerary, StationProperty } from '../../../utils/types'
import AutocompleteInputForm from '../../Form/AutocompleteInputForm/AutocompleteInputForm'
import { Skeleton } from '../../Miscellaneous/LoadingPlaceholder/Skeleton'
import ItineraryDetail from './ItineraryDetail'
import { ItineraryItem } from './ItineraryItem'

interface NavigationModalProps {
    className?: string
}

type ActiveInput = 'start' | 'end' | null

// eslint-disable-next-line react/prop-types
const NavigationModal: React.FC<NavigationModalProps> = ({ className = '' }) => {
    useTrackComponentView('navigation modal')

    const { t } = useTranslation()
    const { userPosition } = useLocation()
    const { data: allStations } = useStations()
    const startInputRef = useRef<HTMLInputElement>(null)
    const endInputRef = useRef<HTMLInputElement>(null)

    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
    const [activeInput, setActiveInput] = useState<ActiveInput>('start')
    const [startLocation, setStartLocation] = useState<string | null>(null)
    const [endLocation, setEndLocation] = useState<string | null>(null)
    const [selectedRoute, setSelectedRoute] = useState<Itinerary | null>(null)

    const { searchValue, setSearchValue, filteredStations: possibleStations } = useStationSearch()

    const { data: navigationData, isLoading } = useNavigation(
        startLocation !== null ? startLocation : '',
        endLocation !== null ? endLocation : '',
        {
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            enabled: Boolean(startLocation && endLocation),
        }
    )

    const handleStationSelect = (stationName: string | null): void => {
        if (stationName === null || !allStations) return

        const selectedStation = Object.entries(allStations).find(([, station]) => station.name === stationName)
        if (!selectedStation) return

        if (activeInput === 'start') {
            setStartLocation(selectedStation[0])
            if (endLocation === null) {
                setTimeout(() => {
                    if (endInputRef.current) {
                        endInputRef.current.focus()
                    }
                }, 0)
            } else {
                setActiveInput(null)
            }
        } else if (activeInput === 'end') {
            setEndLocation(selectedStation[0])
            setActiveInput(null)
        }

        setSearchValue('')
    }

    const getInputValue = (input: ActiveInput): string => {
        if (input === 'start' && startLocation !== null && allStations) {
            return allStations[startLocation].name
        }
        if (input === 'end' && endLocation !== null && allStations) {
            return allStations[endLocation].name
        }
        return activeInput === input ? searchValue : ''
    }

    const handleInputFocus = (input: ActiveInput): void => {
        setActiveInput(input)
        const inputRef = input === 'start' ? startInputRef : endInputRef
        const hasValue = input === 'start' ? startLocation !== null : endLocation !== null

        if (hasValue && inputRef.current) {
            inputRef.current.select()
        }

        // add blue border only to focused input
        ;[startInputRef, endInputRef].forEach((ref) => {
            if (ref.current) {
                ref.current.classList.remove('focused-input')
            }
        })
        if (inputRef.current) {
            inputRef.current.classList.add('focused-input')
        }
    }

    const renderContent = (): React.ReactNode => {
        if (navigationData && startLocation !== null && endLocation !== null) {
            return (
                <div className="navigation-data-container">
                    <div className="safest-route">
                        <ItineraryItem
                            itinerary={navigationData.safestItinerary}
                            onClick={() => {
                                setSelectedRoute(navigationData.safestItinerary)
                                sendAnalyticsEvent('Route selected', {
                                    meta: {
                                        isSafe: true,
                                    },
                                })
                            }}
                        />
                        <div className="safest-route-tag">{t('NavigationModal.safestRoute')}</div>
                    </div>
                    {navigationData.alternativeItineraries.map((route) => (
                        <ItineraryItem
                            key={`route-${route.startTime}-${route.endTime}`}
                            itinerary={route}
                            onClick={() => {
                                setSelectedRoute(route)
                                sendAnalyticsEvent('Route selected', {
                                    meta: {
                                        isSafe: false,
                                    },
                                })
                            }}
                        />
                    ))}
                </div>
            )
        }

        if (isLoading && startLocation !== null && endLocation !== null) {
            return (
                <div className="navigation-data-container">
                    <div className="skeleton-container">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <Skeleton key={`skeleton-${new Date().getTime()}-${i * Math.random()}`} />
                        ))}
                    </div>
                </div>
            )
        }

        return (
            <div className="autocomplete-container">
                <AutocompleteInputForm
                    items={possibleStations}
                    onSelect={handleStationSelect}
                    value={activeInput === 'start' ? startLocation : endLocation}
                    getDisplayValue={(station: StationProperty | null) => station?.name ?? ''}
                    highlightElements={
                        userPosition && activeInput === 'start'
                            ? getClosestStations(3, possibleStations, userPosition).reduce(
                                  (acc, station) => ({ ...acc, ...station }),
                                  {}
                              )
                            : undefined
                    }
                />
            </div>
        )
    }

    if (isFeedbackModalOpen) {
        return <FeedbackForm openAnimationClass={className} onClose={() => setIsFeedbackModalOpen(false)} />
    }

    if (selectedRoute !== null) {
        return (
            <ItineraryDetail
                itinerary={selectedRoute}
                className={className}
                onBack={() => {
                    setSelectedRoute(null)
                }}
            />
        )
    }

    return (
        <div className={`navigation-modal modal container ${className}`}>
            <div className="align-child-on-line">
                <h1>{t('NavigationModal.title')}</h1>
                <FeedbackButton handleButtonClick={() => setIsFeedbackModalOpen(true)} />
            </div>
            <div className="location-inputs">
                <div className="input-container">
                    <img
                        src={`${process.env.PUBLIC_URL}/icons/search.svg`}
                        alt="Search"
                        className="search-icon no-filter"
                    />
                    <input
                        ref={startInputRef}
                        type="text"
                        placeholder={t('NavigationModal.startLocation')}
                        value={getInputValue('start')}
                        onFocus={() => handleInputFocus('start')}
                        onChange={(event) => {
                            setSearchValue(event.target.value)
                            setStartLocation(null)
                        }}
                    />
                </div>
                <div className="input-container">
                    <img
                        src={`${process.env.PUBLIC_URL}/icons/search.svg`}
                        alt="Search"
                        className="search-icon no-filter"
                    />
                    <input
                        ref={endInputRef}
                        type="text"
                        placeholder={t('NavigationModal.endLocation')}
                        value={getInputValue('end')}
                        onFocus={() => handleInputFocus('end')}
                        onChange={(event) => {
                            setSearchValue(event.target.value)
                            setEndLocation(null)
                        }}
                    />
                </div>
            </div>
            {renderContent()}
        </div>
    )
}

export default NavigationModal
