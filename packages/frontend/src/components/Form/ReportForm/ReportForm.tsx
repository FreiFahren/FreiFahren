import './ReportForm.css'

import React, { FC, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FeedbackButton from 'src/components/Buttons/FeedbackButton/FeedbackButton'

import { useLines, useStations, useSubmitReport } from '../../../api/queries'
import { REPORT_COOLDOWN_MINUTES } from '../../../constants'
import { useLocation } from '../../../contexts/LocationContext'
import { sendAnalyticsEvent } from '../../../hooks/useAnalytics'
import { calculateDistance } from '../../../utils/mapUtils'
import { LinesList, Report, StationList, StationProperty } from '../../../utils/types'
import { createWarningSpan, getLineColor, highlightElement } from '../../../utils/uiUtils'
import { Line } from '../../Miscellaneous/Line/Line'
import AutocompleteInputForm from '../AutocompleteInputForm/AutocompleteInputForm'
import { FeedbackForm } from '../FeedbackForm/FeedbackForm'
import { PrivacyCheckbox } from '../PrivacyCheckbox/PrivacyCheckbox'
import { SelectField } from '../SelectField/SelectField'
import { getClosestStations } from '../../../hooks/getClosestStations'
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

    // Calculate possible lines based on the current entity
    const possibleLines = useMemo(() => {
        if (currentEntity === null) return allLines
        return Object.entries(allLines ?? {})
            .filter(([line]) => line.startsWith(currentEntity))
            .reduce(
                (accumulatedLines, [line, stations]) => ({
                    ...accumulatedLines,
                    [line]: stations,
                }),
                {} as LinesList
            )
    }, [allLines, currentEntity])

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
        let stations = sortedAllStations

        if (currentStation !== null) {
            stations = { [currentStation]: allStations![currentStation] }
        } else if (currentLine !== null) {
            stations = Object.fromEntries(
                (allLines?.[currentLine] ?? [])
                    .map((stationKey) => [stationKey, allStations?.[stationKey]])
                    .filter(([, stationData]) => stationData !== undefined) as [string, StationProperty][]
            )
        } else if (currentEntity !== null) {
            stations = Object.entries(sortedAllStations)
                .filter(([, stationData]) => stationData.lines.some((line) => line.startsWith(currentEntity)))
                .reduce(
                    (accumulatedStations, [stationName, stationData]) => ({
                        ...accumulatedStations,
                        [stationName]: stationData,
                    }),
                    {} as StationList
                )
        }
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
    }, [initialContainerHeight, possibleStations, currentLine, currentStation])

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
            if (
                typeof line === 'string' &&
                currentStation !== null &&
                typeof currentStation === 'string' &&
                (allLines?.[line] ?? []).includes(currentStation) === false
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
        if (process.env.NODE_ENV === 'development') {
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

    interface LineChildProps {
        line: string
    }

    const getLineValue = (child: React.ReactElement) => (child.props as LineChildProps).line

    interface EntityChildProps {
        children: {
            props: {
                children: string
            }
        }
    }

    const getEntityValue = (child: React.ReactElement) => (child.props as EntityChildProps).children.props.children

    const getDirectionValue = (child: React.ReactElement) => (child.props as EntityChildProps).children.props.children

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
                                getValue={getEntityValue}
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
                        <section>
                            <h2>{t('ReportForm.line')}</h2>
                            <SelectField
                                containerClassName="align-child-on-line long-selector"
                                onSelect={handleLineSelect}
                                value={currentLine}
                                getValue={getLineValue}
                            >
                                {Object.keys(possibleLines ?? {}).map((line) => (
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
                                    getValue={getDirectionValue}
                                >
                                    <span>
                                        <strong>{(allStations ?? {})[allLines?.[currentLine]?.[0] ?? ''].name}</strong>
                                    </span>
                                    <span>
                                        <strong>
                                            {
                                                (allStations ?? {})[
                                                    allLines?.[currentLine]?.[allLines[currentLine].length - 1] ?? ''
                                                ].name
                                            }
                                        </strong>
                                    </span>
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
