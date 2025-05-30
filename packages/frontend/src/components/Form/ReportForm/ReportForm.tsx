import './ReportForm.css'

import React, { FC, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FeedbackButton from 'src/components/Buttons/FeedbackButton/FeedbackButton'

import { useLines, useStations, useSubmitReport } from '../../../api/queries'
import { REPORT_COOLDOWN_MINUTES } from '../../../constants'
import { useLocation } from '../../../contexts/LocationContext'
import { getClosestStations } from '../../../hooks/getClosestStations'
import { getLineColor } from '../../../hooks/getLineColor'
import { sendAnalyticsEvent } from '../../../hooks/useAnalytics'
import { calculateDistance } from '../../../utils/mapUtils'
import { Report, StationList, StationProperty } from '../../../utils/types'
import { createWarningSpan, highlightElement } from '../../../utils/uiUtils'
import { Line } from '../../Miscellaneous/Line/Line'
import AutocompleteInputForm from '../AutocompleteInputForm/AutocompleteInputForm'
import { FeedbackForm } from '../FeedbackForm/FeedbackForm'
import { PrivacyCheckbox } from '../PrivacyCheckbox/PrivacyCheckbox'
import { SelectField } from '../SelectField/SelectField'

const getCSSVariable = (variable: string): number => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(variable)

    return value !== '0' ? parseFloat(value) : 0
}

interface ReportFormProps {
    onReportFormSubmit: (reportedData: Report) => void
    className?: string
}

const ITEM_HEIGHT = 37

const ReportForm: FC<ReportFormProps> = ({ onReportFormSubmit, className }) => {
    const { t } = useTranslation()

    const { userPosition } = useLocation()
    const { data: allStations } = useStations()
    const { data: allLines } = useLines()

    const [currentEntity, setCurrentEntity] = useState<string | null>(null)
    const [currentLine, setCurrentLine] = useState<string | null>(null)
    const [currentStation, setCurrentStation] = useState<string | null>(null)
    const [currentDirection, setCurrentDirection] = useState<string | null>(null)
    const descriptionRef = useRef<HTMLTextAreaElement>(null)

    const [stationSearch, setStationSearch] = useState<string>('')
    const [searchUsed, setSearchUsed] = useState<boolean>(false)

    const [isPrivacyChecked, setIsPrivacyChecked] = useState<boolean>(false)

    const [stationRecommendationSelected, setStationRecommendationSelected] = useState<boolean>(false)

    const startTime = useRef<Date>(new Date())

    const containerRef = useRef<HTMLDivElement>(null)
    const topElementsRef = useRef<HTMLDivElement>(null)
    const bottomElementsRef = useRef<HTMLDivElement>(null)

    const [stationListHeight, setStationListHeight] = useState<number | null>(null)
    const [initialContainerHeight, setInitialContainerHeight] = useState<number | null>(null)

    const submitReport = useSubmitReport()

    // Constants for layout calculations
    const DIRECTION_SELECTOR_HEIGHT = 80 // Approximate height of direction selector including margins
    const MARGIN_S = getCSSVariable('--margin-s')

    // Helper function to calculate combined padding and margin
    const calculateAllowance = (element: HTMLElement): number => {
        const styles = window.getComputedStyle(element)
        const paddingTop = parseFloat(styles.paddingTop)
        const paddingBottom = parseFloat(styles.paddingBottom)
        const marginTop = parseFloat(styles.marginTop)
        const marginBottom = parseFloat(styles.marginBottom)

        return paddingTop + paddingBottom + marginTop + marginBottom
    }

    const possibleLines = useMemo(() => {
        let filteredLines: [string, string[]][] = []

        // 1. Filter by entity (U, S, M, etc.), dependent on what entities are configured
        if (currentEntity === null) {
            filteredLines = allLines ?? []
        } else {
            filteredLines = (allLines ?? []).filter(([line]) => {
                if (currentEntity === 'M') {
                    return line.startsWith('M') || /^\d/.test(line)
                }
                return line.startsWith(currentEntity)
            })
        }

        // 2. If a station is selected, further filter by lines containing that station
        if (currentStation !== null) {
            filteredLines = filteredLines.filter(([, stations]) => stations.includes(currentStation))
        }

        return filteredLines
    }, [allLines, currentEntity, currentStation])

    // Calculate possible stations based on entity, line, station, and search input
    const possibleStations = useMemo(() => {
        const sortStationRecordsByStationName = (
            recordA: (string | StationProperty)[],
            recordB: (string | StationProperty)[]
        ) => {
            const stationA = recordA[1] as StationProperty
            const stationB = recordB[1] as StationProperty

            if (stationA.name > stationB.name) return 1
            if (stationA.name < stationB.name) return -1
            return 0
        }

        const sortedAllStations = Object.fromEntries(
            Object.entries(allStations ?? {}).sort(sortStationRecordsByStationName)
        )
        let stations: StationList = sortedAllStations

        if (currentStation !== null) {
            // If a specific station is already selected, just use that one
            stations = allStations?.[currentStation] ? { [currentStation]: allStations[currentStation] } : {}
        } else if (currentLine !== null) {
            // If a line is selected, filter stations belonging to that line
            // Find the stations for the current line from the allLines array
            const stationsForCurrentLine = allLines?.find(([key]) => key === currentLine)?.[1] ?? []
            stations = Object.fromEntries(
                stationsForCurrentLine
                    .map((stationKey) => [stationKey, allStations?.[stationKey]])
                    .filter(([, stationData]) => stationData !== undefined) as [string, StationProperty][]
            )
        } else if (currentEntity !== null) {
            // If an entity is selected, filter based on the station key prefix
            stations = Object.entries(sortedAllStations)
                .filter(([stationKey]) => {
                    // eslint-disable-next-line prefer-destructuring
                    const prefix = stationKey.split('-')[0]
                    return prefix.includes(currentEntity)
                })
                .reduce(
                    (accumulatedStations, [stationName, stationData]) => ({
                        ...accumulatedStations,
                        [stationName]: stationData,
                    }),
                    {} as StationList
                )
        }

        // Further filter by search input if provided
        if (stationSearch) {
            stations = Object.entries(stations)
                .filter(([, stationData]) => stationData.name.toLowerCase().includes(stationSearch.toLowerCase()))
                .reduce(
                    (accumulatedStations, [stationName, stationData]) => ({
                        ...accumulatedStations,
                        [stationName]: stationData,
                    }),
                    {} as StationList
                )
        }

        return stations
    }, [allLines, allStations, currentEntity, currentLine, currentStation, stationSearch])

    const calculateStationListHeight = useCallback(() => {
        if (containerRef.current && topElementsRef.current && bottomElementsRef.current) {
            const container = containerRef.current
            const top = topElementsRef.current
            const bottom = bottomElementsRef.current

            // Set initial container height once
            if (initialContainerHeight === null) {
                setInitialContainerHeight(container.clientHeight)
            }

            const containerHeight = initialContainerHeight ?? container.clientHeight
            const topHeight = top.offsetHeight
            const bottomHeight = bottom.offsetHeight

            // Calculate base margins
            const dynamicDivMargins = MARGIN_S * 2

            // Calculate space needed for direction selector if visible
            const directionSelectorSpace =
                currentLine !== null && currentStation !== null && currentLine !== 'S41' && currentLine !== 'S42'
                    ? DIRECTION_SELECTOR_HEIGHT
                    : 0

            // Calculate total space needed
            const containerAllowance = calculateAllowance(container) + dynamicDivMargins
            const topAllowance = calculateAllowance(top) + dynamicDivMargins
            const bottomAllowance = calculateAllowance(bottom) + dynamicDivMargins
            const totalAllowance = containerAllowance + topAllowance + bottomAllowance + MARGIN_S

            // Calculate available height
            const stationCount = Object.keys(possibleStations).length
            const availableHeight = Math.max(
                0,
                containerHeight - topHeight - bottomHeight - totalAllowance - directionSelectorSpace
            )

            const newStationListHeight = Math.max(0, Math.min(stationCount * ITEM_HEIGHT, availableHeight))
            setStationListHeight(newStationListHeight)
        }
    }, [initialContainerHeight, possibleStations, currentLine, currentStation, MARGIN_S])

    // Handle resize and content changes
    useEffect(() => {
        calculateStationListHeight()

        const handleResize = () => calculateStationListHeight()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [calculateStationListHeight])

    const handleEntitySelect = useCallback(
        (entity: string | null) => {
            setCurrentEntity(entity)

            // Only reset subsequent selections if the current line is no longer valid
            if (currentLine !== null && entity !== null && !currentLine.startsWith(entity)) {
                setCurrentLine(null)
                setCurrentStation(null)
                setCurrentDirection(null)
            }
            // if a station is selected check if the station is still valid for the selected entity
            else if (currentStation !== null && entity !== null) {
                const stationData = allStations?.[currentStation]

                if (stationData) {
                    const isValidStation = stationData.lines.some((line) => line.startsWith(entity))

                    if (!isValidStation) {
                        setCurrentStation(null)
                        setCurrentDirection(null)
                    }
                }
            }
        },
        [currentLine, currentStation, allStations]
    )

    const handleLineSelect = useCallback(
        (line: string | null) => {
            setCurrentLine(line)
            // Find the stations for the selected line from the allLines array
            const stationsForSelectedLine = allLines?.find(([key]) => key === line)?.[1] ?? []
            if (
                typeof line === 'string' &&
                currentStation !== null &&
                typeof currentStation === 'string' &&
                !stationsForSelectedLine.includes(currentStation) // Use the found stations array
            ) {
                setCurrentStation(null)
            }
        },
        [allLines, currentStation]
    )

    const handleStationSelect = useCallback(
        (stationName: string | null) => {
            const foundStationEntry = Object.entries(allStations ?? {}).find(
                ([, stationData]) => stationData.name === stationName
            )

            setCurrentStation(foundStationEntry ? foundStationEntry[0] : null)
            setStationSearch('')
        },
        [allStations]
    )

    const handleDirectionSelect = useCallback(
        (directionName: string | null) => {
            const foundStationEntry = Object.entries(allStations ?? {}).find(
                ([, stationData]) => stationData.name === directionName
            )

            setCurrentDirection(foundStationEntry ? foundStationEntry[0] : null)
        },
        [allStations]
    )

    const verifyUserLocation = (station: string | null, stationsList: StationList): boolean => {
        if (station === null) return false

        const distance = userPosition
            ? calculateDistance(
                  userPosition.lat,
                  userPosition.lng,
                  stationsList[station].coordinates.latitude,
                  stationsList[station].coordinates.longitude
              )
            : 0

        // Checks if the user is more than 5 km away from the station
        if (distance > 5) {
            highlightElement('report-form')
            createWarningSpan(
                'searchable-select-div',
                'Du bist zu weit von der Station entfernt. Bitte wähle die richtige Station!'
            )
            return true // Indicates an error
        }

        return false
    }

    const validateReportForm = async () => {
        let hasError = false

        // Check for last report time to prevent spamming
        const lastReportTime = localStorage.getItem('lastReportTime')

        if (
            lastReportTime !== null &&
            Date.now() - new Date(lastReportTime).getTime() < REPORT_COOLDOWN_MINUTES * 60 * 1000
        ) {
            highlightElement('report-form')
            createWarningSpan(
                'searchable-select-div',
                `Du kannst nur alle ${REPORT_COOLDOWN_MINUTES} Minuten eine Meldung abgeben!`
            )
            hasError = true
        }

        if (currentStation === null) {
            highlightElement('searchable-select-div')
            createWarningSpan(
                'searchable-select-div',
                'Du hast keine Station ausgewählt. Bitte wähle eine Station aus!'
            )
            hasError = true
        }

        if (!(document.getElementById('privacy-checkbox') as HTMLInputElement).checked) {
            highlightElement('privacy-label')
            hasError = true
        }

        const locationError = verifyUserLocation(currentStation, allStations ?? {})

        if (locationError) {
            hasError = true
        }

        // otherwise it is too annoying to test
        if (import.meta.env.DEV) {
            return false
        }

        return hasError // Return true if there's an error, false otherwise
    }

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault()

        const hasError = await validateReportForm()

        if (hasError) return // Abort submission if there are validation errors

        try {
            const endTime = new Date()
            const durationInSeconds = Math.round((endTime.getTime() - startTime.current.getTime()) / 1000)

            const report: Report = {
                line: currentLine,
                station: {
                    id: currentStation!,
                    name: (allStations ?? {})[currentStation!].name,
                    coordinates: (allStations ?? {})[currentStation!].coordinates,
                },
                direction:
                    currentDirection !== null
                        ? {
                              id: currentDirection,
                              name: (allStations ?? {})[currentDirection!].name,
                              coordinates: (allStations ?? {})[currentDirection!].coordinates,
                          }
                        : null,
                message: descriptionRef.current?.value ?? '',
                timestamp: endTime.toISOString(),
                isHistoric: false,
            }

            await submitReport.mutateAsync(report)

            const finalizeSubmission = (timestamp: Date) => {
                localStorage.setItem('lastReportTime', timestamp.toISOString())
                onReportFormSubmit(report)
            }

            try {
                await sendAnalyticsEvent('Report Submitted', {
                    duration: durationInSeconds,
                    meta: {
                        Station: report.station.name,
                        ...(report.line !== null && { Line: report.line }),
                        Direction: report.direction?.name,
                        Entity: Boolean(currentEntity),
                        SearchUsed: searchUsed,
                        StationRecommendationUsed: stationRecommendationSelected,
                    },
                })

                finalizeSubmission(endTime)
            } catch (error) {
                // fix later with sentry
                // eslint-disable-next-line no-console
                console.error('Failed to send analytics event:', error)
                finalizeSubmission(endTime)
            }
        } catch (error) {
            // fix later with sentry
            // eslint-disable-next-line no-console
            console.error('Failed to submit report:', error)
        }
    }

    // Helper function to get value from <span><strong>VALUE</strong></span> structure
    const getSpanStrongValue = useCallback((child: React.ReactElement): string => {
        try {
            // Use assertion here as well for the initial access
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const innerElement = (child.props as any)?.children
            // Check if it's a valid element and has props and props.children
            if (
                React.isValidElement(innerElement) &&
                // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                innerElement.props &&
                // Assert props as any to access children, assuming the checks are sufficient
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                typeof (innerElement.props as any).children !== 'undefined'
            ) {
                // Ensure the result is a string using the same assertion
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return String((innerElement.props as any).children ?? '')
            }
            return ''
        } catch (error) {
            return ''
        }
    }, [])

    interface LineChildProps {
        line: string
    }

    const getLineValue = (child: React.ReactElement) => (child.props as LineChildProps).line

    const [showFeedback, setShowFeedback] = useState<boolean>(false)
    if (showFeedback) {
        return <FeedbackForm openAnimationClass={className} />
    }

    return (
        <div className={`report-form container modal ${className}`} ref={containerRef}>
            <form onSubmit={handleSubmit}>
                <div>
                    <div ref={topElementsRef}>
                        <div className="align-child-on-line">
                            <h1>{t('ReportForm.title')}</h1>
                            <FeedbackButton handleButtonClick={() => setShowFeedback(true)} />
                        </div>
                        <section>
                            <SelectField
                                containerClassName="align-child-on-line large-selector"
                                fieldClassName="entity-type-selector"
                                onSelect={handleEntitySelect}
                                value={currentEntity}
                                getValue={getSpanStrongValue}
                            >
                                <span className="line" style={{ backgroundColor: getLineColor('U8') }}>
                                    <strong>U</strong>
                                </span>
                                <span className="line" style={{ backgroundColor: getLineColor('S2') }}>
                                    <strong>S</strong>
                                </span>
                                <span className="line" style={{ backgroundColor: getLineColor('M1') }}>
                                    <strong>M</strong>
                                </span>
                            </SelectField>
                        </section>
                        <section className="line-selector">
                            <h2>{t('ReportForm.line')}</h2>
                            <SelectField
                                containerClassName="align-child-on-line long-selector"
                                onSelect={handleLineSelect}
                                value={currentLine}
                                getValue={getLineValue}
                            >
                                {possibleLines.map(([line]) => (
                                    <Line key={line} line={line} />
                                ))}
                            </SelectField>
                        </section>
                    </div>
                    <AutocompleteInputForm
                        items={possibleStations}
                        onSelect={handleStationSelect}
                        value={currentStation}
                        getDisplayValue={(station: StationProperty) => station.name}
                        placeholder={t('ReportForm.searchPlaceholder')}
                        label={t('ReportForm.station')}
                        required
                        setSearchUsed={setSearchUsed}
                        listHeight={stationListHeight}
                        highlightElements={
                            userPosition
                                ? getClosestStations(3, possibleStations, userPosition).reduce(
                                      (acc, station) => ({ ...acc, ...station }),
                                      {}
                                  )
                                : undefined
                        }
                        setHighlightedElementSelected={setStationRecommendationSelected}
                    />
                    <div ref={bottomElementsRef}>
                        {currentLine !== null &&
                        currentLine !== 'S41' &&
                        currentLine !== 'S42' &&
                        currentStation !== null ? (
                            <section>
                                <h3>{t('ReportForm.direction')}</h3>
                                <SelectField
                                    onSelect={handleDirectionSelect}
                                    value={currentDirection !== null ? (allStations ?? {})[currentDirection].name : ''}
                                    containerClassName="align-child-on-line"
                                    getValue={getSpanStrongValue}
                                >
                                    {(() => {
                                        // Find stations for the current line from the allLines array
                                        const stationsForCurrentLine =
                                            allLines?.find(([key]) => key === currentLine)?.[1] ?? []
                                        const startStationId = stationsForCurrentLine[0] ?? ''
                                        const endStationId =
                                            stationsForCurrentLine[stationsForCurrentLine.length - 1] ?? ''

                                        const startStationName = (allStations ?? {})[startStationId].name
                                        const endStationName = (allStations ?? {})[endStationId].name

                                        // If names can't be found, return an empty array
                                        if (!startStationName || !endStationName) return []

                                        // Return an array of individual span elements
                                        return [
                                            <span key={startStationId || 'start'}>
                                                <strong>{startStationName}</strong>
                                            </span>,
                                            <span key={endStationId || 'end'}>
                                                <strong>{endStationName}</strong>
                                            </span>,
                                        ]
                                    })()}
                                </SelectField>
                            </section>
                        ) : null}
                        {currentStation !== null ? (
                            <section className="description-field">
                                <h3>{t('ReportForm.description')}</h3>
                                <textarea ref={descriptionRef} placeholder={t('ReportForm.descriptionPlaceholder')} />
                            </section>
                        ) : null}
                        <section>
                            <div>
                                {currentStation !== null ? (
                                    <PrivacyCheckbox
                                        isChecked={isPrivacyChecked}
                                        onChange={() => setIsPrivacyChecked(!isPrivacyChecked)}
                                    />
                                ) : null}
                            </div>
                            <div>
                                <button
                                    type="submit"
                                    className={isPrivacyChecked && currentStation !== null ? '' : 'button-gray'}
                                >
                                    {t('ReportForm.report')}
                                </button>
                                <p className="disclaimer">{t('ReportForm.syncText')}</p>
                            </div>
                        </section>
                    </div>
                </div>
            </form>
        </div>
    )
}

export { ReportForm }
