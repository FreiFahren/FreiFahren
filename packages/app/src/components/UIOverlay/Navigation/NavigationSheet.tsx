import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons'
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { format } from 'date-fns'
import Fuse from 'fuse.js'
import { isNil } from 'lodash'
import React, { forwardRef, Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, LayoutAnimation, StyleSheet, TouchableOpacity } from 'react-native'

import { Itinerary } from '../../../api/client'
import { useItineraries, useLines, useStations } from '../../../api/queries'
import { Theme } from '../../../theme'
import { FFText, FFTextInput, FFView } from '../../common/base'
import { FFLineTag } from '../../common/FFLineTag'
import { FFScrollSheet } from '../../common/FFSheet'

// Animation configurations
const fadeAnimation = {
    duration: 250,
    create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
    },
    update: {
        type: LayoutAnimation.Types.easeInEaseOut,
    },
    delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
    },
}

// Helper function to get line color from theme (similar to FFLineTag)
const getLineColor = (line: string) => (line.startsWith('M') ? 'lines.tram' : `lines.${line}`) as keyof Theme['colors']

// Keep only the styles that can't be easily expressed with restyle props
const styles = StyleSheet.create({
    legIcon: {
        marginRight: 4,
    },
    safetyBadge: {
        position: 'absolute',
        top: -10,
        left: 10,
        zIndex: 1,
    },
    backButton: {
        position: 'absolute',
        left: 0,
        top: 5,
        zIndex: 10,
    },
})

// Helper function to format duration in minutes
const formatDuration = (durationInSeconds: number): string => {
    const minutes = Math.floor(durationInSeconds / 60)

    return `${minutes} min`
}

// Helper function to format time
const formatTime = (timeString: string): string => {
    const date = new Date(timeString)

    return format(date, 'HH:mm')
}

// Component to render a single leg of an itinerary
const ItineraryLeg = ({ leg }: { leg: Itinerary['legs'][0] }) => {
    // Determine icon based on mode
    const renderIcon = () => {
        switch (leg.mode) {
            case 'WALK':
                return <FontAwesome5 name="walking" size={16} color="#FFF" style={styles.legIcon} />
            case 'BUS':
                return <FontAwesome5 name="bus" size={16} color="#FFF" style={styles.legIcon} />
            case 'TRAM':
            case 'METRO':
                return <MaterialCommunityIcons name="tram" size={18} color="#FFF" style={styles.legIcon} />
            case 'SUBWAY':
                return <MaterialCommunityIcons name="subway-variant" size={18} color="#FFF" style={styles.legIcon} />
            case 'REGIONAL_RAIL':
                return <MaterialCommunityIcons name="train" size={18} color="#FFF" style={styles.legIcon} />
            default:
                return <Feather name="arrow-right" size={16} color="#FFF" style={styles.legIcon} />
        }
    }

    return (
        <FFView flexDirection="row" alignItems="center">
            {renderIcon()}
            {leg.mode !== 'WALK' && leg.routeShortName !== undefined && leg.routeShortName.length > 0 && (
                <FFLineTag line={leg.routeShortName} ml="xxs" />
            )}
        </FFView>
    )
}

// Arrow separator between legs with smaller size
const LegSeparator = () => (
    <FFView px="xxs">
        <Feather name="chevron-right" size={14} color="#999" />
    </FFView>
)

// Component to render a single itinerary
const ItineraryCard = ({
    itinerary,
    isSafest = false,
    onPress,
}: {
    itinerary: Itinerary
    isSafest?: boolean
    onPress?: () => void
}) => {
    const { t } = useTranslation('navigation')

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
            <FFView
                borderWidth={1}
                borderColor="border"
                borderRadius="m"
                mb="xs"
                p="xs"
                pt={isSafest ? 'm' : 'xs'}
                position="relative"
                {...(isSafest && {
                    borderColor: 'safetyGreen',
                    borderWidth: 2,
                })}
            >
                {/* Safety badge positioned to overlap with the top border */}
                {isSafest && (
                    <FFView style={styles.safetyBadge} bg="safetyGreen" borderRadius="s" px="xxs" py="xxxs">
                        <FFText color="fg" variant="labelBold" fontSize={14}>
                            {t('safestRoute')}
                        </FFText>
                    </FFView>
                )}

                {/* Legs at the top - no wrapping, with overflow handling */}
                <FFView flexDirection="row" alignItems="center" mb="xxs">
                    <FFView flexDirection="row" alignItems="center" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                        {itinerary.legs.slice(0, 4).map((leg, index) => (
                            // eslint-disable-next-line react/no-array-index-key
                            <React.Fragment key={`leg-${itinerary.startTime}-${index}`}>
                                {index > 0 && <LegSeparator />}
                                <ItineraryLeg leg={leg} />
                            </React.Fragment>
                        ))}
                        {itinerary.legs.length > 4 && (
                            <FFView ml="xs">
                                <FFText color="darkText" fontSize={13}>
                                    +{itinerary.legs.length - 4}
                                </FFText>
                            </FFView>
                        )}
                    </FFView>
                </FFView>

                {/* Time and transfers together at the bottom */}
                <FFView flexDirection="row" justifyContent="space-between" mt="xxs" alignItems="center">
                    <FFView flexDirection="row" alignItems="center">
                        <Feather name="clock" size={14} color="#FFF" style={{ marginRight: 4 }} />
                        <FFText color="fg" fontSize={13} fontWeight="bold">
                            {formatTime(itinerary.startTime)} - {formatTime(itinerary.endTime)}
                        </FFText>
                    </FFView>

                    <FFView flexDirection="row" alignItems="center">
                        <Feather name="repeat" size={14} color="#FFF" style={{ marginRight: 4 }} />
                        <FFText color="fg" fontSize={13}>
                            {t('transfersCount', { count: itinerary.transfers })}
                        </FFText>
                    </FFView>

                    <FFText color="fg" fontSize={13}>
                        {formatDuration(itinerary.duration)}
                    </FFText>
                </FFView>

                {/* Risk score if available */}
                {itinerary.calculatedRisk !== undefined && (
                    <FFView mt="xxs" alignSelf="flex-end">
                        <FFText color="darkText" fontSize={12}>
                            {t('riskScore', { score: Math.round(itinerary.calculatedRisk * 100) })}
                        </FFText>
                    </FFView>
                )}
            </FFView>
        </TouchableOpacity>
    )
}

// Define interface for ItineraryListView component props
interface ItineraryListViewProps {
    selectItinerary: (itinerary: Itinerary, isSafest: boolean) => void
    onInputFocusChange: (isFocused: boolean) => void
    startQuery: string
    setStartQuery: React.Dispatch<React.SetStateAction<string>>
    destinationQuery: string
    setDestinationQuery: React.Dispatch<React.SetStateAction<string>>
    selectedStart: string | undefined
    setSelectedStart: React.Dispatch<React.SetStateAction<string | undefined>>
    selectedDestination: string | undefined
    setSelectedDestination: React.Dispatch<React.SetStateAction<string | undefined>>
}

// Itinerary List Screen Component
const ItineraryListView = ({
    selectItinerary,
    onInputFocusChange,
    startQuery,
    setStartQuery,
    destinationQuery,
    setDestinationQuery,
    selectedStart,
    setSelectedStart,
    selectedDestination,
    setSelectedDestination,
}: ItineraryListViewProps) => {
    const { t } = useTranslation(['navigation', 'common'])
    const { data: stations } = useStations()

    // Keep only UI-specific state in ItineraryListView
    const [showStartSuggestions, setShowStartSuggestions] = useState(false)
    const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false)
    const [startInputFocused, setStartInputFocused] = useState(false)
    const [destinationInputFocused, setDestinationInputFocused] = useState(false)

    // Handle focus events with blur timeout
    const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Clean up any pending timeouts
    useEffect(() => {
        return () => {
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current)
            }
        }
    }, [])

    // Setup Fuse.js for station search
    const stationFuse = useMemo(() => {
        if (stations === undefined) return null

        const stationList = Object.entries(stations).map(([id, station]) => ({
            id,
            name: (station as { name: string }).name.replace(/^(S|U)\s+/i, ' '),
        }))

        return new Fuse(stationList, {
            keys: ['name'],
            threshold: 0.4,
        })
    }, [stations])

    // Define a type for the station suggestion item
    type StationSuggestion = {
        id: string
        name: string
    }

    // Get filtered station suggestions
    const startSuggestions = useMemo(() => {
        // Animate when suggestions change
        if (stationFuse !== null && startQuery !== '' && startQuery.length >= 2) {
            LayoutAnimation.configureNext(fadeAnimation)
        }

        if (stationFuse === null || startQuery === '' || startQuery.length < 2) return []
        return stationFuse.search(startQuery).slice(0, 5) as StationSuggestion[]
    }, [stationFuse, startQuery])

    const destinationSuggestions = useMemo(() => {
        // Animate when suggestions change
        if (stationFuse !== null && destinationQuery !== '' && destinationQuery.length >= 2) {
            LayoutAnimation.configureNext(fadeAnimation)
        }

        if (stationFuse === null || destinationQuery === '' || destinationQuery.length < 2) return []
        return stationFuse.search(destinationQuery).slice(0, 5) as StationSuggestion[]
    }, [stationFuse, destinationQuery])

    // Get itineraries when both stations are selected
    const { isLoading: isLoadingItineraries, data: itineraries } = useItineraries(selectedStart, selectedDestination)

    // Handle station selection
    const handleSelectStartStation = (stationId: string, stationName: string) => {
        LayoutAnimation.configureNext(fadeAnimation)
        setSelectedStart(stationId)
        setStartQuery(stationName)
        setShowStartSuggestions(false)
    }

    const handleSelectDestinationStation = (stationId: string, stationName: string) => {
        LayoutAnimation.configureNext(fadeAnimation)
        setSelectedDestination(stationId)
        setDestinationQuery(stationName)
        setShowDestinationSuggestions(false)
    }

    // Handle focus events
    const handleStartInputFocus = useCallback(() => {
        // Cancel any pending blur timeout
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current)
            blurTimeoutRef.current = null
        }

        setStartInputFocused(true)
        onInputFocusChange(true)
    }, [onInputFocusChange])

    const handleDestinationInputFocus = useCallback(() => {
        // Cancel any pending blur timeout
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current)
            blurTimeoutRef.current = null
        }

        setDestinationInputFocused(true)
        onInputFocusChange(true)
    }, [onInputFocusChange])

    // Handle blur events with a short delay to prevent premature collapse
    const handleStartInputBlur = useCallback(() => {
        blurTimeoutRef.current = setTimeout(() => {
            setStartInputFocused(false)
            if (!destinationInputFocused) {
                onInputFocusChange(false)
            }
            blurTimeoutRef.current = null
        }, 100) // Short delay to allow other input to focus first
    }, [destinationInputFocused, onInputFocusChange])

    const handleDestinationInputBlur = useCallback(() => {
        blurTimeoutRef.current = setTimeout(() => {
            setDestinationInputFocused(false)
            if (!startInputFocused) {
                onInputFocusChange(false)
            }
            blurTimeoutRef.current = null
        }, 100) // Short delay to allow other input to focus first
    }, [startInputFocused, onInputFocusChange])

    return (
        <FFView>
            <FFText variant="header1" mb="m" color="fg">
                {t('navigation:title')}
            </FFText>

            {/* Start station input */}
            <FFText variant="header2" fontWeight="bold" color="fg" mb="xxs">
                {t('common:startStation')}
            </FFText>
            <FFView
                backgroundColor="darkGrey"
                borderRadius="m"
                mb={showStartSuggestions && startSuggestions.length > 0 ? 'xxs' : 's'}
                borderWidth={1}
                borderColor="border"
                flexDirection="row"
                alignItems="center"
            >
                <FFView style={{ paddingLeft: 12 }}>
                    <Feather name="map-pin" size={16} color="#8A8A8A" />
                </FFView>
                <FFTextInput
                    value={startQuery}
                    onChangeText={(text) => {
                        setStartQuery(text)
                        setShowStartSuggestions(true)
                        if (text === '') {
                            setSelectedStart(undefined)
                        }
                    }}
                    onFocus={handleStartInputFocus}
                    onBlur={handleStartInputBlur}
                    placeholder={t('navigation:enterStartStation')}
                    placeholderTextColor="#8A8A8A"
                    color="fg"
                    paddingHorizontal="s"
                    paddingVertical="xs"
                    fontSize={16}
                    style={{ flex: 1 }}
                />
                {startQuery.length > 0 && (
                    <FFView style={{ paddingRight: 12 }}>
                        <TouchableOpacity onPress={() => setStartQuery('')}>
                            <Feather name="x" size={16} color="#8A8A8A" />
                        </TouchableOpacity>
                    </FFView>
                )}
            </FFView>

            {/* Start station suggestions */}
            {showStartSuggestions === true && startSuggestions.length > 0 && (
                <FFView
                    backgroundColor="darkGrey"
                    borderRadius="m"
                    mb="s"
                    borderWidth={1}
                    borderColor="border"
                    overflow="hidden"
                >
                    {startSuggestions.map((suggestion) => (
                        <TouchableOpacity
                            key={suggestion.id}
                            onPress={() => handleSelectStartStation(suggestion.id, suggestion.name)}
                            activeOpacity={0.7}
                        >
                            <FFView
                                padding="s"
                                borderBottomWidth={1}
                                borderBottomColor="border"
                                flexDirection="row"
                                alignItems="center"
                            >
                                <FFView style={{ marginRight: 8 }}>
                                    <Feather name="map-pin" size={14} color="#8A8A8A" />
                                </FFView>
                                <FFText color="fg" fontSize={15}>
                                    {suggestion.name}
                                </FFText>
                            </FFView>
                        </TouchableOpacity>
                    ))}
                </FFView>
            )}

            {/* Destination station input */}
            <FFText variant="header2" fontWeight="bold" color="fg" mb="xxs">
                {t('common:destinationStation')}
            </FFText>
            <FFView
                backgroundColor="darkGrey"
                borderRadius="m"
                mb={showDestinationSuggestions && destinationSuggestions.length > 0 ? 'xxs' : 's'}
                borderWidth={1}
                borderColor="border"
                flexDirection="row"
                alignItems="center"
            >
                <FFView style={{ paddingLeft: 12 }}>
                    <Feather name="flag" size={16} color="#8A8A8A" />
                </FFView>
                <FFTextInput
                    value={destinationQuery}
                    onChangeText={(text) => {
                        setDestinationQuery(text)
                        setShowDestinationSuggestions(true)
                        if (text === '') {
                            setSelectedDestination(undefined)
                        }
                    }}
                    onFocus={handleDestinationInputFocus}
                    onBlur={handleDestinationInputBlur}
                    placeholder={t('navigation:enterDestinationStation')}
                    placeholderTextColor="#8A8A8A"
                    color="fg"
                    paddingHorizontal="s"
                    paddingVertical="xs"
                    fontSize={16}
                    style={{ flex: 1 }}
                />
                {destinationQuery.length > 0 && (
                    <FFView style={{ paddingRight: 12 }}>
                        <TouchableOpacity onPress={() => setDestinationQuery('')}>
                            <Feather name="x" size={16} color="#8A8A8A" />
                        </TouchableOpacity>
                    </FFView>
                )}
            </FFView>

            {/* Destination station suggestions */}
            {showDestinationSuggestions === true && destinationSuggestions.length > 0 && (
                <FFView
                    backgroundColor="darkGrey"
                    borderRadius="m"
                    mb="s"
                    borderWidth={1}
                    borderColor="border"
                    overflow="hidden"
                >
                    {destinationSuggestions.map((suggestion) => (
                        <TouchableOpacity
                            key={suggestion.id}
                            onPress={() => handleSelectDestinationStation(suggestion.id, suggestion.name)}
                            activeOpacity={0.7}
                        >
                            <FFView
                                padding="s"
                                borderBottomWidth={1}
                                borderBottomColor="border"
                                flexDirection="row"
                                alignItems="center"
                            >
                                <FFView style={{ marginRight: 8 }}>
                                    <Feather name="flag" size={14} color="#8A8A8A" />
                                </FFView>
                                <FFText color="fg" fontSize={15}>
                                    {suggestion.name}
                                </FFText>
                            </FFView>
                        </TouchableOpacity>
                    ))}
                </FFView>
            )}

            {/* Loading state when fetching itineraries */}
            {selectedStart !== undefined && selectedDestination !== undefined && isLoadingItineraries === true && (
                <FFView alignItems="center" justifyContent="center" padding="l">
                    <ActivityIndicator size="large" color="#ffffff" />
                    <FFText mt="s">{t('navigation:loadingItineraries')}</FFText>
                </FFView>
            )}

            {/* Itinerary Results */}
            {itineraries !== undefined && (
                <FFView mt="m">
                    <FFText variant="header2" color="fg" mb="s">
                        {t('navigation:routeResults')}
                    </FFText>

                    {/* Safest Itinerary */}
                    <ItineraryCard
                        itinerary={itineraries.safestItinerary}
                        isSafest={true}
                        onPress={() => selectItinerary(itineraries.safestItinerary, true)}
                    />

                    {/* Alternative Itineraries */}
                    {itineraries.alternativeItineraries.length > 0 &&
                        itineraries.alternativeItineraries.map((itinerary, index) => (
                            <ItineraryCard
                                // Using a more specific key to avoid ESLint warning about using index
                                // eslint-disable-next-line react/no-array-index-key
                                key={`alt-itinerary-${itinerary.startTime}-${itinerary.endTime}-${index}`}
                                itinerary={itinerary}
                                onPress={() => selectItinerary(itinerary, false)}
                            />
                        ))}
                </FFView>
            )}
        </FFView>
    )
}

// Define interface for ItineraryDetailsView component props
interface ItineraryDetailsViewProps {
    itinerary: Itinerary
    isSafest: boolean
    onBack: () => void
}

// Itinerary Details View Component
const ItineraryDetailsView = ({ itinerary, isSafest = false, onBack }: ItineraryDetailsViewProps) => {
    const { t } = useTranslation('navigation')
    const { data: lines } = useLines()

    return (
        <FFView flex={1}>
            <FFView flexDirection="row" alignItems="center" mb="m">
                <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
                    <Feather name="arrow-left" size={24} color="#FFF" />
                </TouchableOpacity>

                <FFView flex={1} alignItems="center">
                    <FFText variant="header2" color="fg">
                        {t('routeDetails', 'Route Details')}
                    </FFText>
                </FFView>
            </FFView>

            {/* Route summary card */}
            <FFView
                borderWidth={1}
                borderColor="border"
                borderRadius="m"
                mb="m"
                p="s"
                pt={isSafest ? 'm' : 's'}
                position="relative"
                {...(isSafest && {
                    borderColor: 'safetyGreen',
                    borderWidth: 2,
                })}
            >
                {/* Safety badge if applicable */}
                {isSafest && (
                    <FFView style={styles.safetyBadge} bg="safetyGreen" borderRadius="s" px="xxs" py="xxxs">
                        <FFText color="fg" variant="labelBold" fontSize={14}>
                            {t('safestRoute')}
                        </FFText>
                    </FFView>
                )}

                <FFView flexDirection="row" justifyContent="space-between">
                    <FFView>
                        <FFText color="darkText" fontSize={12}>
                            {t('departure', 'Departure')}
                        </FFText>
                        <FFText fontWeight="bold" fontSize={18}>
                            {formatTime(itinerary.startTime)}
                        </FFText>
                    </FFView>

                    <FFView alignItems="center">
                        <FFText color="darkText" fontSize={12}>
                            {t('duration', 'Duration')}
                        </FFText>
                        <FFText fontSize={16}>{formatDuration(itinerary.duration)}</FFText>
                    </FFView>

                    <FFView alignItems="flex-end">
                        <FFText color="darkText" fontSize={12}>
                            {t('arrival', 'Arrival')}
                        </FFText>
                        <FFText fontWeight="bold" fontSize={18}>
                            {formatTime(itinerary.endTime)}
                        </FFText>
                    </FFView>
                </FFView>

                <FFView flexDirection="row" alignItems="center" mt="xs">
                    <Feather name="repeat" size={14} color="#FFF" style={{ marginRight: 4 }} />
                    <FFText color="fg" fontSize={14}>
                        {t('transfersCount', { count: itinerary.transfers })}
                    </FFText>
                </FFView>

                {/* Risk score if available */}
                {itinerary.calculatedRisk !== undefined && (
                    <FFView mt="xs" alignSelf="flex-end">
                        <FFText color="darkText" fontSize={12}>
                            {t('riskScore', { score: Math.round(itinerary.calculatedRisk * 100) })}
                        </FFText>
                    </FFView>
                )}
            </FFView>

            {/* Detailed legs information */}
            <FFText variant="labelBold" fontSize={16} mb="s" color="fg">
                {t('routeSteps', 'Route Steps')}
            </FFText>

            {itinerary.legs.map((leg, index) => {
                const isWalking = leg.mode === 'WALK'
                const isFirstLeg = index === 0

                // Get the theme color for transit lines
                const colorKey = isWalking
                    ? 'darkText'
                    : !isNil(leg.routeShortName) && !isNil(lines) && leg.routeShortName in lines
                      ? getLineColor(leg.routeShortName)
                      : 'danger'

                return (
                    <FFView
                        key={`detail-leg-${leg.from.name}-${leg.to.name}-${leg.startTime}`}
                        ml="xs"
                        pl="s"
                        mb="s"
                        position="relative"
                    >
                        {/* Use the same component structure for both transit and walking lines */}
                        <FFView
                            position="absolute"
                            left={0}
                            top={0}
                            bottom={0}
                            style={{ width: 6, borderRadius: 3 }}
                            bg={colorKey}
                        />

                        {/* Leg mode and line number */}
                        <FFView flexDirection="row" alignItems="center" ml="s">
                            <FFView style={{ marginRight: 8 }}>
                                {leg.mode === 'WALK' ? (
                                    <FontAwesome5 name="walking" size={18} color="#FFF" />
                                ) : leg.mode === 'BUS' ? (
                                    <FontAwesome5 name="bus" size={18} color="#FFF" />
                                ) : leg.mode === 'TRAM' || leg.mode === 'METRO' ? (
                                    <MaterialCommunityIcons name="tram" size={20} color="#FFF" />
                                ) : leg.mode === 'SUBWAY' ? (
                                    <MaterialCommunityIcons name="subway-variant" size={20} color="#FFF" />
                                ) : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                                leg.mode === 'REGIONAL_RAIL' ? (
                                    <MaterialCommunityIcons name="train" size={20} color="#FFF" />
                                ) : (
                                    <Feather name="arrow-right" size={18} color="#FFF" />
                                )}
                            </FFView>

                            {/* Line number if not walking */}
                            {!isWalking && !isNil(leg.routeShortName) && (
                                <FFLineTag line={leg.routeShortName} style={{ marginRight: 8 }} />
                            )}

                            {/* Leg description - removed "To" */}
                            <FFView style={{ flex: 1 }}>
                                <FFText fontSize={15} color="fg">
                                    {isWalking ? t('walkTo', { destination: leg.to.name }) : leg.to.name}
                                </FFText>
                            </FFView>
                        </FFView>

                        {/* Only show start station & time for the first leg */}
                        {isFirstLeg && (
                            <FFView flexDirection="row" alignItems="center" ml="s" mt="xs">
                                <FFView style={{ flex: 1 }}>
                                    <FFText fontWeight="bold" fontSize={15} color="fg">
                                        {leg.from.name}
                                    </FFText>
                                </FFView>
                                <FFText color="darkText" fontSize={13}>
                                    {formatTime(leg.startTime)}
                                </FFText>
                            </FFView>
                        )}

                        {/* Travel time in middle */}
                        <FFText color="darkText" fontSize={13} ml="s" mt="xs">
                            {formatDuration(leg.duration)}
                        </FFText>

                        {/* End station & time at bottom */}
                        <FFView flexDirection="row" alignItems="center" ml="s" mt="xs">
                            <FFView style={{ flex: 1 }}>
                                <FFText fontWeight="bold" fontSize={15} color="fg">
                                    {leg.to.name}
                                </FFText>
                            </FFView>
                            <FFText color="darkText" fontSize={13}>
                                {formatTime(leg.endTime)}
                            </FFText>
                        </FFView>
                    </FFView>
                )
            })}
        </FFView>
    )
}

// Main Navigation Sheet Component
export const NavigationSheet = forwardRef((_, ref: Ref<BottomSheetModalMethods>) => {
    // Move route-related state back to NavigationSheet
    const [startQuery, setStartQuery] = useState('')
    const [destinationQuery, setDestinationQuery] = useState('')
    const [selectedStart, setSelectedStart] = useState<string | undefined>(undefined)
    const [selectedDestination, setSelectedDestination] = useState<string | undefined>(undefined)

    // Keep essential sheet and navigation state
    const [isAnyInputFocused, setIsAnyInputFocused] = useState(false)
    const [selectedItinerary, setSelectedItinerary] = useState<Itinerary | null>(null)
    const [selectedItineraryIsSafest, setSelectedItineraryIsSafest] = useState(false)

    // Define snap points
    const snapPoints = useMemo(() => {
        // Use larger snap point when showing details
        if (selectedItinerary !== null) {
            return ['25%', '80%']
        }
        return isAnyInputFocused ? ['25%', '90%'] : ['25%', '50%']
    }, [isAnyInputFocused, selectedItinerary])

    // Handle itinerary selection with animation
    const selectItinerary = useCallback(
        (itinerary: Itinerary, isSafest: boolean) => {
            LayoutAnimation.configureNext(fadeAnimation)
            setSelectedItinerary(itinerary)
            setSelectedItineraryIsSafest(isSafest)

            // Expand the sheet when showing details
            if (ref && 'current' in ref && ref.current) {
                ref.current.expand()
            }
        },
        [ref]
    )

    // Handle back from itinerary details with animation
    const handleBackToList = useCallback(() => {
        LayoutAnimation.configureNext(fadeAnimation)
        setSelectedItinerary(null)
    }, [])

    // Handle input focus changes
    const handleInputFocusChange = useCallback(
        (isFocused: boolean) => {
            setIsAnyInputFocused(isFocused)

            // Expand the sheet when input is focused
            if (isFocused && ref && 'current' in ref && ref.current) {
                ref.current.expand()
            }
        },
        [ref]
    )

    return (
        <FFScrollSheet ref={ref} snapPoints={snapPoints} index={1}>
            <FFView flex={1}>
                {/* Conditionally render either the list view or the details view */}
                {selectedItinerary === null ? (
                    <ItineraryListView
                        selectItinerary={selectItinerary}
                        onInputFocusChange={handleInputFocusChange}
                        startQuery={startQuery}
                        setStartQuery={setStartQuery}
                        destinationQuery={destinationQuery}
                        setDestinationQuery={setDestinationQuery}
                        selectedStart={selectedStart}
                        setSelectedStart={setSelectedStart}
                        selectedDestination={selectedDestination}
                        setSelectedDestination={setSelectedDestination}
                    />
                ) : (
                    <ItineraryDetailsView
                        itinerary={selectedItinerary}
                        isSafest={selectedItineraryIsSafest}
                        onBack={handleBackToList}
                    />
                )}
            </FFView>
        </FFScrollSheet>
    )
})
