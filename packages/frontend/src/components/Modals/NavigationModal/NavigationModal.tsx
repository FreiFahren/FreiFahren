import './NavigationModal.css'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FeedbackButton from 'src/components/Buttons/FeedbackButton/FeedbackButton'
import { FeedbackForm } from 'src/components/Form/FeedbackForm/FeedbackForm'

import { useNavigation, useStations } from '../../../api/queries'
import { useLocation } from '../../../contexts/LocationContext'
import { getClosestStations } from '../../../hooks/getClosestStations'
import { sendAnalyticsEvent, useTrackComponentView } from '../../../hooks/useAnalytics'
import { useStationSearch } from '../../../hooks/useStationSearch'
import { Itinerary, Station } from '../../../utils/types'
import { SelectField } from '../../Form/SelectField/SelectField'
import StationButton from '../../Buttons/StationButton'
import { Skeleton } from '../../Miscellaneous/LoadingPlaceholder/Skeleton'
import { CenterModal } from '../CenterModal'
import ItineraryDetail from './ItineraryDetail'
import { ItineraryItem } from './ItineraryItem'

interface NavigationModalProps {
    className?: string
    initialEndStation?: Station | null
    initialRoute?: Itinerary | null
    savedRoute?: Itinerary | null
    onSaveRoute?: (route: Itinerary) => void
    onRemoveRoute?: () => void
}

type ActiveInput = 'start' | 'end' | null

const NavigationModal: React.FC<NavigationModalProps> = ({
    className = '',
    initialEndStation,
    initialRoute,
    savedRoute,
    onSaveRoute,
    onRemoveRoute,
}) => {
    useTrackComponentView('navigation modal')

    const { t } = useTranslation()
    const { userPosition } = useLocation()
    const { data: stationsData } = useStations()
    const startInputRef = useRef<HTMLInputElement>(null)
    const endInputRef = useRef<HTMLInputElement>(null)

    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
    const [activeInput, setActiveInput] = useState<ActiveInput>('start')
    const [startLocation, setStartLocation] = useState<string | null>(null)
    const [hasUserInteractedWithStart, setHasUserInteractedWithStart] = useState(false)
    const [endLocation, setEndLocation] = useState<string | null>(() => {
        if (initialEndStation && stationsData) {
            const stationEntry = Object.entries(stationsData).find(
                ([, station]) => station.name === initialEndStation.name
            )
            return stationEntry ? stationEntry[0] : null
        }
        return null
    })

    // If an initial route is provided, show it immediately
    const [selectedRoute, setSelectedRoute] = useState<Itinerary | null>(initialRoute ?? null)

    const { searchValue, setSearchValue, filteredStations } = useStationSearch()

    // Convert stations data to Station[] format like in ReportForm
    const allStations: Station[] = stationsData
        ? Object.entries(stationsData)
              .map(([id, stationProperty]) => ({
                  id,
                  name: stationProperty.name,
                  coordinates: stationProperty.coordinates,
                  lines: stationProperty.lines,
              }))
              .sort((a, b) => a.name.localeCompare(b.name))
        : []

    const possibleStations = searchValue.trim() !== '' ? filteredStations : allStations

    const { data: navigationData, isLoading } = useNavigation(
        startLocation !== null ? startLocation : '',
        endLocation !== null ? endLocation : '',
        {
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            enabled: startLocation !== null && endLocation !== null,
        }
    )

    const handleStationSelect = useCallback(
        (stationId: string | null): void => {
            if (stationId === null || !allStations.length) return

            const selectedStation = allStations.find((station) => station.id === stationId)
            if (!selectedStation) return

            if (activeInput === 'start') {
                setStartLocation(selectedStation.id)
                setHasUserInteractedWithStart(true)
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
                setEndLocation(selectedStation.id)
                setActiveInput(null)
            }

            setSearchValue('')
        },
        [
            allStations,
            activeInput,
            endLocation,
            setStartLocation,
            setActiveInput,
            setEndLocation,
            setSearchValue,
            endInputRef,
        ]
    )

    // set start location to the closest station if user has no start location (only on initial load)
    useEffect(() => {
        if (userPosition && allStations.length && startLocation === null && !hasUserInteractedWithStart) {
            const closestStations = getClosestStations(1, allStations, userPosition)
            if (closestStations.length > 0) {
                handleStationSelect(closestStations[0].id)
            }
        }
    }, [userPosition, allStations, startLocation, hasUserInteractedWithStart, handleStationSelect])

    const getInputValue = (input: ActiveInput): string => {
        if (input === 'start' && startLocation !== null) {
            const station = allStations.find((s) => s.id === startLocation)
            return station ? station.name : ''
        }
        if (input === 'end' && endLocation !== null) {
            const station = allStations.find((s) => s.id === endLocation)
            return station ? station.name : ''
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
                <div className="navigation-data-container flex h-full flex-col">
                    <div className="flex-1 overflow-y-auto p-2 pl-6">
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
                </div>
            )
        }

        if (isLoading && startLocation !== null && endLocation !== null) {
            return (
                <div className="navigation-data-container flex h-full flex-col">
                    <div className="flex-1 overflow-y-auto p-2 pl-6">
                        <div className="skeleton-container">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <Skeleton key={`skeleton-${new Date().getTime()}-${i * Math.random()}`} />
                            ))}
                        </div>
                    </div>
                </div>
            )
        }

        return (
            <div className="station-selection-container flex h-full flex-col">
                <div className="flex-1 overflow-y-auto p-2 pl-6">
                    {userPosition && !searchValue.trim() && activeInput === 'start' && (
                        <>
                            {getClosestStations(3, possibleStations, userPosition).map((station) => (
                                <SelectField
                                    key={`recommended-${station.id}`}
                                    containerClassName="mb-1"
                                    onSelect={() => handleStationSelect(station.id)}
                                    value={'placeholder since the regular station will be selected'}
                                >
                                    <StationButton station={station} data-select-value={station.id} />
                                </SelectField>
                            ))}
                            <hr className="my-2" />
                        </>
                    )}
                    {possibleStations.map((station) => (
                        <SelectField
                            key={`station-${station.id}`}
                            containerClassName="mb-1 p-0"
                            onSelect={handleStationSelect}
                            value={activeInput === 'start' ? startLocation : endLocation}
                        >
                            <StationButton station={station} data-select-value={station.id} />
                        </SelectField>
                    ))}
                </div>
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
                handleSaveRoute={onSaveRoute}
                handleRemoveRoute={onRemoveRoute}
                isSaved={
                    !!savedRoute && savedRoute.startTime === selectedRoute.startTime
                        ? savedRoute.endTime === selectedRoute.endTime
                        : false
                }
            />
        )
    }

    return (
        <CenterModal animationType="popup" className={`${className} flex h-full flex-col overflow-y-auto pt-0`}>
            <div className="bg-background sticky top-0 flex-shrink-0 pt-2">
                <div className="align-child-on-line">
                    <h1>{t('NavigationModal.title')}</h1>
                    <FeedbackButton handleButtonClick={() => setIsFeedbackModalOpen(true)} />
                </div>
                <div className="location-inputs mb-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <img
                            src="/icons/location-pin-alt-1-svgrepo-com.svg"
                            alt="Search"
                            className="h-4 w-4 brightness-0 invert"
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
                                setHasUserInteractedWithStart(true)
                            }}
                            className="flex-1 rounded-sm border-2 border-gray-300 p-1"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <img src="/icons/flag-svgrepo-com.svg" alt="Search" className="h-4 w-4 brightness-0 invert" />
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
                            className="flex-1 rounded-sm border-2 border-gray-300 p-1"
                        />
                    </div>
                </div>
            </div>
            <div className="min-h-0 flex-1">{renderContent()}</div>
        </CenterModal>
    )
}

export default NavigationModal
