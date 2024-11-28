import './ReportForm.css'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useLocation } from '../../../contexts/LocationContext'
import { useStationsAndLines } from '../../../contexts/StationsAndLinesContext'
import { sendAnalyticsEvent } from '../../../utils/analytics'
import { LinesList, reportInspector, StationList } from '../../../utils/databaseUtils'
import { calculateDistance } from '../../../utils/mapUtils'
import { createWarningSpan, getLineColor, highlightElement } from '../../../utils/uiUtils'
import { AutocompleteInputForm } from '../AutocompleteInputForm/AutocompleteInputForm'
import { SelectField } from '../SelectField/SelectField'

const getCSSVariable = (variable: string): number => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(variable)

    const parsed = parseFloat(value)

    return Number.isNaN(parsed) ? 0 : parsed
}

const redHighlight = (text: string) => (
    <>
        {text}
        <span className="red-highlight">*</span>
    </>
)

interface ReportFormProps {
    closeModal: () => void
    notifyParentAboutSubmission: () => void
    className?: string
}

const ITEM_HEIGHT = 37
const REPORT_COOLDOWN_MINUTES = 15

export const ReportForm = ({ closeModal, notifyParentAboutSubmission, className }: ReportFormProps) => {
    const { t } = useTranslation()

    const { userPosition } = useLocation()
    const { allLines, allStations } = useStationsAndLines()

    const [currentEntity, setCurrentEntity] = useState<string | null>(null)
    const [currentLine, setCurrentLine] = useState<string | null>(null)
    const [currentStation, setCurrentStation] = useState<string | null>(null)
    const [currentDirection, setCurrentDirection] = useState<string | null>(null)
    const [description, setDescription] = useState<string>('')

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
        return Object.entries(allLines)
            .filter(([line]) => line.startsWith(currentEntity))
            .reduce((acc, [line, stations]) => {
                // eslint-disable-next-line no-param-reassign
                acc[line] = stations
                return acc
            }, {} as LinesList)
    }, [allLines, currentEntity])

    // Calculate possible stations based on entity, line, station, and search input
    const possibleStations = useMemo(() => {
        let stations = allStations

        if (currentStation !== null) {
            stations = { [currentStation]: allStations[currentStation] }
        } else if (currentLine !== null) {
            stations = Object.fromEntries(
                allLines[currentLine].map((stationKey) => [stationKey, allStations[stationKey]])
            )
        } else if (currentEntity !== null) {
            stations = Object.entries(allStations)
                .filter(([, stationData]) => stationData.lines.some((line) => line.startsWith(currentEntity)))
                .reduce((acc, [stationName, stationData]) => {
                    // eslint-disable-next-line no-param-reassign
                    acc[stationName] = stationData
                    return acc
                }, {} as StationList)
        }
        if (stationSearch) {
            stations = Object.entries(stations)
                .filter(([, stationData]) => stationData.name.toLowerCase().includes(stationSearch.toLowerCase()))
                .reduce((acc, [stationName, stationData]) => {
                    // eslint-disable-next-line no-param-reassign
                    acc[stationName] = stationData
                    return acc
                }, {} as StationList)
        }

        return stations
    }, [allLines, allStations, currentEntity, currentLine, currentStation, stationSearch])

    const calculateStationListHeight = useCallback(() => {
        if (containerRef.current && topElementsRef.current && bottomElementsRef.current) {
            const container = containerRef.current
            const top = topElementsRef.current
            const bottom = bottomElementsRef.current

            // Set initial container height once to retrieve it when user deselects a station
            if (initialContainerHeight === null) {
                setInitialContainerHeight(container.clientHeight)
            }

            const containerHeight = initialContainerHeight ?? container.clientHeight
            const topHeight = top.offsetHeight
            const bottomHeight = bottom.offsetHeight

            const marginS = getCSSVariable('--margin-s')

            // Calculate total dynamic margins
            // two margins between top and bottom elements
            const dynamicDivMargins = marginS * 2

            // Calculate total allowance
            const containerAllowance = calculateAllowance(container) + dynamicDivMargins
            const topAllowance = calculateAllowance(top) + dynamicDivMargins
            const bottomAllowance = calculateAllowance(bottom) + dynamicDivMargins

            const totalAllowance = containerAllowance + topAllowance + bottomAllowance + marginS

            const stationCount = Object.keys(possibleStations).length
            const availableHeight = containerHeight - topHeight - bottomHeight - totalAllowance

            const newStationListHeight = Math.min(stationCount * ITEM_HEIGHT, availableHeight)

            setStationListHeight(newStationListHeight)
        }
    }, [initialContainerHeight, possibleStations])

    useEffect(() => {
        calculateStationListHeight()
        const handleResize = () => calculateStationListHeight()

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [calculateStationListHeight, possibleStations])

    const handleEntitySelect = useCallback((entity: string | null) => {
        setCurrentEntity(entity)
        setCurrentLine(null)
        setCurrentStation(null)
        setCurrentDirection(null)
    }, [])

    const handleLineSelect = useCallback(
        (line: string | null) => {
            setCurrentLine(line)
            if (line !== null && currentStation !== null && !allLines[line].includes(currentStation)) {
                setCurrentStation(null)
            }
        },
        [allLines, currentStation]
    )

    const handleStationSelect = useCallback(
        (stationName: string | null) => {
            const foundStationEntry = Object.entries(allStations).find(
                ([, stationData]) => stationData.name === stationName
            )

            setCurrentStation(foundStationEntry ? foundStationEntry[0] : null)
            setStationSearch('')
        },
        [allStations]
    )

    const handleDirectionSelect = useCallback(
        (directionName: string | null) => {
            const foundStationEntry = Object.entries(allStations).find(
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

        if (lastReportTime !== null && Date.now() - new Date(lastReportTime).getTime() < REPORT_COOLDOWN_MINUTES * 60 * 1000) {
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

        const locationError = verifyUserLocation(currentStation, allStations)

        if (locationError) {
            hasError = true
        }

        return hasError // Return true if there's an error, false otherwise
    }
    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()

        const hasError = await validateReportForm()

        if (hasError) return // Abort submission if there are validation errors

        await reportInspector(currentLine!, currentStation!, currentDirection!, description)

        const endTime = new Date()
        const durationInSeconds = Math.round((endTime.getTime() - startTime.current.getTime()) / 1000)

        const finalizeSubmission = () => {
            localStorage.setItem('lastReportTime', new Date().toISOString()) // Save the timestamp of the report to prevent spamming
            closeModal()
            notifyParentAboutSubmission()
        }

        sendAnalyticsEvent('Report Submitted', {
            duration: durationInSeconds,
            meta: {
                Station: currentStation!,
                Line: currentLine!,
                Direction: currentDirection!,
                Entity: Boolean(currentEntity),
                SearchUsed: searchUsed,
                StationRecommendationUsed: stationRecommendationSelected,
            },
        })

        finalizeSubmission()
    }


    const getClosestStationsToUser = (
        numberOfStations: number,
        stationsList: StationList,
        userCoordinates: { lat: number; lng: number }
    ) => {
        const distances = Object.entries(stationsList).map(([station, stationData]) => {
            const distance = calculateDistance(
                userCoordinates.lat,
                userCoordinates.lng,
                stationData.coordinates.latitude,
                stationData.coordinates.longitude
            )

            return { station, stationData, distance }
        })

        distances.sort((a, b) => a.distance - b.distance)
        return distances.slice(0, numberOfStations).map((entry) => ({ [entry.station]: entry.stationData }))
    }

    return (
        <div className={`report-form container modal ${className}`} ref={containerRef}>
            <form onSubmit={handleSubmit}>
                <div>
                    <div ref={topElementsRef}>
                        <h1>{t('ReportForm.title')}</h1>
                        <section>
                            <SelectField
                                containerClassName="align-child-on-line large-selector"
                                fieldClassName="entity-type-selector"
                                onSelect={handleEntitySelect}
                                value={currentEntity}
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
                            >
                                {Object.keys(possibleLines).map((line) => (
                                    <span key={line} className="line" style={{ backgroundColor: getLineColor(line) }}>
                                        <strong>{line}</strong>
                                    </span>
                                ))}
                            </SelectField>
                        </section>
                    </div>
                    <AutocompleteInputForm
                        items={possibleStations}
                        onSelect={handleStationSelect}
                        value={currentStation}
                        getDisplayValue={(station) => station.name}
                        placeholder={t('ReportForm.searchPlaceholder')}
                        label={t('ReportForm.station')}
                        required
                        setSearchUsed={setSearchUsed}
                        listHeight={stationListHeight}
                        highlightElements={
                            userPosition
                                ? getClosestStationsToUser(3, possibleStations, userPosition).reduce(
                                    (acc, station) => ({ ...acc, ...station }),
                                    {}
                                )
                                : undefined
                        }
                        setHighlightedElementSelected={setStationRecommendationSelected}
                    />
                    <div ref={bottomElementsRef}>
                        {currentLine !== null && currentLine !== 'S41' && currentLine !== 'S42' && currentStation !== null && (
                            <section>
                                <h3>{t('ReportForm.direction')}</h3>
                                <SelectField
                                    onSelect={handleDirectionSelect}
                                    value={currentDirection !== null ? allStations[currentDirection].name : ''}
                                    containerClassName="align-child-on-line"
                                >
                                    <span>
                                        <strong>{allStations[allLines[currentLine][0]].name}</strong>
                                    </span>
                                    <span>
                                        <strong>
                                            {allStations[allLines[currentLine][allLines[currentLine].length - 1]].name}
                                        </strong>
                                    </span>
                                </SelectField>
                            </section>
                        )}
                        <section className="description-field">
                            <h3>{t('ReportForm.description')}</h3>
                            <textarea
                                placeholder={t('ReportForm.descriptionPlaceholder')}
                                onChange={(event) => setDescription(event.target.value)}
                                value={description}
                            />
                        </section>
                        <section>
                            <div>
                                <label htmlFor="privacy-checkbox" id="privacy-label">
                                    <input
                                        type="checkbox"
                                        id="privacy-checkbox"
                                        name="privacy-checkbox"
                                        checked={isPrivacyChecked}
                                        onChange={() => setIsPrivacyChecked(!isPrivacyChecked)}
                                    />
                                    {t('ReportForm.privacy1')}
                                    <a href="/datenschutz"> {t('ReportForm.privacy2')} </a> {t('ReportForm.privacy3')}
                                    {redHighlight('')}
                                </label>
                            </div>
                            <div>
                                <button
                                    type="submit"
                                    className={isPrivacyChecked && currentStation !== null ? '' : 'button-gray'}
                                >
                                    {t('ReportForm.report')}
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </form>
        </div>
    )
}
