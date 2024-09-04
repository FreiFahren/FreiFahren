/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'

import './ReportForm.css'
import SelectField from '../SelectField/SelectField'
import { getAllLinesList, LinesList, getAllStationsList, StationList, reportInspector } from '../../../utils/dbUtils'
import { sendAnalyticsEvent } from '../../../utils/analytics'
import { highlightElement, createWarningSpan } from '../../../utils/uiUtils'
import { calculateDistance } from '../../../utils/mapUtils'

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
    userPosition?: { lat: number; lng: number } | null
}

const search_icon = `${process.env.PUBLIC_URL}/icons/search.svg`

const ReportForm: React.FC<ReportFormProps> = ({
    closeModal,
    notifyParentAboutSubmission,
    className,
    userPosition,
}) => {
    const [allLines, setAllLines] = useState<LinesList>({})
    const [allStations, setAllStations] = useState<StationList>({})

    const [currentEntity, setCurrentEntity] = useState<string | null>(null)
    const [currentLine, setCurrentLine] = useState<string | null>(null)
    const [currentStation, setCurrentStation] = useState<string | null>(null)
    const [currentDirection, setCurrentDirection] = useState<string | null>(null)
    const [description, setDescription] = useState<string>('')

    const [showSearchBox, setShowSearchBox] = useState<boolean>(false)
    const [stationSearch, setStationSearch] = useState<string>('')
    const searchInputRef = useRef<HTMLInputElement>(null)

    const [isPrivacyChecked, setIsPrivacyChecked] = useState<boolean>(false)

    const startTime = new Date()

    useEffect(() => {
        const fetchLinesAndStations = async () => {
            const [lines, stations] = await Promise.all([getAllLinesList(), getAllStationsList()])
            setAllLines(lines)
            setAllStations(stations)
        }
        fetchLinesAndStations()
    }, [])

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
            setShowSearchBox(false)
        },
        [allStations]
    )

    const toggleSearchBox = useCallback(() => {
        setShowSearchBox((prev) => !prev)
        setTimeout(() => {
            if (searchInputRef.current) {
                searchInputRef.current.focus()
            }
        }, 0)
    }, [])

    const handleDirectionSelect = useCallback((direction: string | null) => {
        setCurrentDirection(direction)
    }, [])

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
                'station-select-div',
                `Du kannst nur alle ${reportCooldownMinutes} Minuten eine Meldung abgeben!`
            )
            hasError = true
        }

        if (!currentStation) {
            highlightElement('station-select-div')
            createWarningSpan('station-select-div', 'Du hast keine Station ausgewählt. Bitte wähle eine Station aus!')
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
                'station-select-div',
                'Du bist zu weit von der Station entfernt. Bitte wähle die richtige Station!'
            )
            return true // Indicates an error
        }

        return false
    }

    return (
        <div className={`report-form container modal ${className}`}>
            <form onSubmit={handleSubmit}>
                <div>
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
                    <section>
                        <div className="align-child-on-line" id="station-select-div">
                            <h2>Station</h2>
                            <input
                                className={`search-input ${showSearchBox ? 'expanded' : ''}`}
                                type="text"
                                placeholder="Suche eine Station"
                                value={stationSearch}
                                onChange={(e) => setStationSearch(e.target.value)}
                                ref={searchInputRef}
                            />
                            <img src={search_icon} onClick={toggleSearchBox} alt="icon to search for a station"></img>
                        </div>
                        <SelectField
                            onSelect={handleStationSelect}
                            value={currentStation ? allStations[currentStation].name : ''}
                            containerClassName="align-child-column"
                        >
                            {Object.entries(possibleStations).map(([stationKey, stationData]) => (
                                <div key={stationKey}>
                                    <strong>{stationData.name}</strong>
                                </div>
                            ))}
                        </SelectField>
                    </section>
                    {currentLine && (
                        <section>
                            <h3>Richtung</h3>
                            <SelectField
                                onSelect={handleDirectionSelect}
                                value={currentDirection}
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
                                Ich stimme der <a href="/datenschutz"> Datenschutzerklärung </a> zu. {redHighlight('')}
                            </label>
                        </div>
                        <div>
                            <button type="submit" className={isPrivacyChecked && currentStation ? '' : 'button-gray'}>
                                Melden
                            </button>
                        </div>
                    </section>
                </div>
            </form>
        </div>
    )
}

export default ReportForm

// Todo:
// - Add smooth animations for everything
// - Add anayltics to track how often the search icon and entity selector are used
