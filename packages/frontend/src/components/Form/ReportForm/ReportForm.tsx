import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'

import SelectField from '../SelectField/SelectField'
import AutocompleteInputForm from '../AutocompleteInputForm/AutocompleteInputForm'

import { LinesList, StationList, reportInspector } from '../../../utils/dbUtils'
import { sendAnalyticsEvent } from '../../../utils/analytics'
import { highlightElement, createWarningSpan } from '../../../utils/uiUtils'
import { calculateDistance } from '../../../utils/mapUtils'
import { useLocation } from '../../../contexts/LocationContext'
import { useStationsAndLines } from '../../../contexts/StationsAndLinesContext'

import './ReportForm.css'

const redHighlight = (text: string) => {
    return (
        <>
            {text}
            <span className="red-highlight">*</span>
        </>
    )
}

interface ReportFormProps {
    closeModal: () => void
    notifyParentAboutSubmission: () => void
    className?: string
}

const ReportForm: React.FC<ReportFormProps> = ({ closeModal, notifyParentAboutSubmission, className }) => {
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

    const startTime = new Date()

    // filter the lines based on entity
    const possibleLines = useMemo(() => {
        if (!currentEntity) return allLines
        return Object.entries(allLines)
            .filter(([line]) => line.startsWith(currentEntity))
            .reduce((acc, [line, stations]) => {
                acc[line] = stations
                return acc
            }, {} as LinesList)
    }, [allLines, currentEntity])

    // filter the stations based on entity, line, station, and search input
    const possibleStations = useMemo(() => {
        let stations = allStations
        if (currentStation) {
            stations = { [currentStation]: allStations[currentStation] }
        } else if (currentLine) {
            stations = Object.fromEntries(
                allLines[currentLine].map((stationKey) => [stationKey, allStations[stationKey]])
            )
        } else if (currentEntity) {
            stations = Object.entries(allStations)
                .filter(([, stationData]) => stationData.lines.some((line) => line.startsWith(currentEntity)))
                .reduce((acc, [stationName, stationData]) => {
                    acc[stationName] = stationData
                    return acc
                }, {} as StationList)
        }
        if (stationSearch) {
            stations = Object.entries(stations)
                .filter(([, stationData]) => stationData.name.toLowerCase().includes(stationSearch.toLowerCase()))
                .reduce((acc, [stationName, stationData]) => {
                    acc[stationName] = stationData
                    return acc
                }, {} as StationList)
        }

        return stations
    }, [allLines, allStations, currentEntity, currentLine, currentStation, stationSearch])

    const containerRef = useRef<HTMLDivElement>(null)
    const topElementsRef = useRef<HTMLDivElement>(null)
    const bottomElementsRef = useRef<HTMLDivElement>(null)
    const [stationListHeight, setStationListHeight] = useState<number | null>(null)
    const [initialContainerHeight, setInitialContainerHeight] = useState<number | null>(null)

    const ITEM_HEIGHT = 37
    const PADDING_MARGIN_ALLOWANCE = 65

    const calculateStationListHeight = useCallback(() => {
        if (containerRef.current && topElementsRef.current && bottomElementsRef.current) {
            if (initialContainerHeight === null) {
                // Set the initial container height only once
                setInitialContainerHeight(containerRef.current.clientHeight)
            }

            const containerHeight = initialContainerHeight || containerRef.current.clientHeight
            const topElementsHeight = topElementsRef.current.clientHeight
            const bottomElementsHeight = bottomElementsRef.current.clientHeight
            const stationCount = Object.keys(possibleStations).length

            // Calculate the ideal height for the station list
            const idealListHeight = Math.min(
                stationCount * ITEM_HEIGHT + PADDING_MARGIN_ALLOWANCE,
                containerHeight - topElementsHeight - bottomElementsHeight - PADDING_MARGIN_ALLOWANCE
            )

            // Set the new height, ensuring it's not less than the minimum
            setStationListHeight(idealListHeight)

            // Adjust the container height
            const newContainerHeight = Math.min(
                topElementsHeight + idealListHeight + bottomElementsHeight + PADDING_MARGIN_ALLOWANCE,
                initialContainerHeight || containerHeight
            )
            containerRef.current.style.height = `${newContainerHeight}px`
        }
    }, [possibleStations, initialContainerHeight])

    useEffect(() => {
        calculateStationListHeight()
        window.addEventListener('resize', calculateStationListHeight)
        return () => window.removeEventListener('resize', calculateStationListHeight)
    }, [calculateStationListHeight])

    // Recalculate when possibleStations change
    useEffect(() => {
        calculateStationListHeight()
    }, [possibleStations, calculateStationListHeight])

    const handleEntitySelect = useCallback((entity: string | null) => {
        setCurrentEntity(entity)
        setCurrentLine(null)
        setCurrentStation(null)
        setCurrentDirection(null)
    }, [])

    const handleLineSelect = useCallback(
        (line: string | null) => {
            setCurrentLine(line)
            if (line && currentStation && !allLines[line].includes(currentStation)) {
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

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()

        const hasError = await validateReportForm()
        if (hasError) return // Abort submission if there are validation errors

        await reportInspector(currentLine!, currentStation!, currentDirection!, description)

        const endTime = new Date()
        const durationInSeconds = startTime ? Math.round((endTime.getTime() - startTime.getTime()) / 1000) : 0

        async function finalizeSubmission() {
            localStorage.setItem('lastReportTime', new Date().toISOString()) // Save the timestamp of the report to prevent spamming
            closeModal()
            notifyParentAboutSubmission()
        }

        try {
            await sendAnalyticsEvent('Report Submitted', {
                duration: durationInSeconds,
                meta: {
                    Station: currentStation!,
                    Line: currentLine!,
                    Direction: currentDirection!,
                    Entity: Boolean(currentEntity),
                    SearchUsed: searchUsed,
                },
            })

            finalizeSubmission()
        } catch (error) {
            console.error('Failed to send analytics event:', error)
            finalizeSubmission()
        }
    }

    const validateReportForm = async () => {
        let hasError = false

        // Check for last report time to prevent spamming
        const lastReportTime = localStorage.getItem('lastReportTime')
        const reportCooldownMinutes = 15

        if (lastReportTime && Date.now() - new Date(lastReportTime).getTime() < reportCooldownMinutes * 60 * 1000) {
            highlightElement('report-form')
            createWarningSpan(
                'searchable-select-div',
                `Du kannst nur alle ${reportCooldownMinutes} Minuten eine Meldung abgeben!`
            )
            hasError = true
        }

        if (!currentStation) {
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

        const locationError = await verifyUserLocation(currentStation, allStations)
        if (locationError) {
            hasError = true
        }

        return hasError // Return true if there's an error, false otherwise
    }

    async function verifyUserLocation(station: string | null, stationsList: StationList): Promise<boolean> {
        if (!station) return false

        const distance = userPosition
            ? calculateDistance(
                  userPosition.lat,
                  userPosition.lng,
                  stationsList[station].coordinates.latitude,
                  stationsList[station].coordinates.longitude
              )
            : 0

        // Checks if the user is more than 5 km away from the station
        if (5 < distance) {
            highlightElement('report-form')
            createWarningSpan(
                'searchable-select-div',
                'Du bist zu weit von der Station entfernt. Bitte wähle die richtige Station!'
            )
            return true // Indicates an error
        }

        return false
    }

    return (
        <div className={`report-form container modal ${className}`} ref={containerRef}>
            <form onSubmit={handleSubmit}>
                <div>
                    <div ref={topElementsRef}>
                        <h1>Neue Meldung</h1>
                        <section>
                            <SelectField
                                containerClassName="align-child-on-line large-selector"
                                fieldClassName="entity-type-selector"
                                onSelect={handleEntitySelect}
                                value={currentEntity}
                            >
                                <span className="line U8">
                                    <strong>U</strong>
                                </span>
                                <span className="line S2">
                                    <strong>S</strong>
                                </span>
                            </SelectField>
                        </section>
                        <section>
                            <h2>Linie</h2>
                            <SelectField
                                containerClassName="align-child-on-line long-selector"
                                onSelect={handleLineSelect}
                                value={currentLine}
                            >
                                {Object.keys(possibleLines).map((line) => (
                                    <span key={line} className={`line ${line}`}>
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
                        placeholder="Suche eine Station"
                        label="Station"
                        required={true}
                        setSearchUsed={setSearchUsed}
                        listHeight={stationListHeight}
                    />
                    <div ref={bottomElementsRef}>
                        {currentLine && currentLine !== 'S41' && currentLine !== 'S42' && (
                            <section>
                                <h3>Richtung</h3>
                                <SelectField
                                    onSelect={handleDirectionSelect}
                                    value={currentDirection ? allStations[currentDirection].name : ''}
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
                            <h3>Beschreibung</h3>
                            <textarea
                                placeholder="Beschreibung"
                                onChange={(e) => setDescription(e.target.value)}
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
                                    Ich stimme der <a href="/datenschutz"> Datenschutzerklärung </a> zu.{' '}
                                    {redHighlight('')}
                                </label>
                            </div>
                            <div>
                                <button
                                    type="submit"
                                    className={isPrivacyChecked && currentStation ? '' : 'button-gray'}
                                >
                                    Melden
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </form>
        </div>
    )
}

export default ReportForm
