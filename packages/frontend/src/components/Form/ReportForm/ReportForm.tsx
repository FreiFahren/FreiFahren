import React, { useState, useEffect, useCallback } from 'react'
import './ReportForm.css'

import SelectField from '../SelectField/SelectField'
import { getAllLinesList, LinesList, getAllStationsList, StationList } from '../../../utils/dbUtils'
interface ReportFormProps {
    closeModal: () => void
    onFormSubmit: () => void
    className?: string
    userPosition?: { lat: number; lng: number } | null
}

const ReportForm: React.FC<ReportFormProps> = ({ closeModal, onFormSubmit, className, userPosition }) => {
    const [allLines, setAllLines] = useState<LinesList>({})
    const [allStations, setAllStations] = useState<StationList>({})

    const [currentEntity, setCurrentEntity] = useState<string | null>(null)
    const [currentLine, setCurrentLine] = useState<string | null>(null)
    const [currentStation, setCurrentStation] = useState<string | null>(null)

    const [possibleLines, setPossibleLines] = useState<LinesList>({})
    const [possibleStations, setPossibleStations] = useState<StationList>({})

    useEffect(() => {
        const fetchLines = async () => {
            const lines = await getAllLinesList()
            setAllLines(lines)
            setPossibleLines(lines) // Set possible lines to all lines initially
        }
        const fetchStations = async () => {
            const stations = await getAllStationsList()
            setAllStations(stations)
            setPossibleStations(stations)
        }

        fetchLines()
        fetchStations()
    }, [])

    const updatePossibleStations = useCallback(
        (currentEntity: string | null, currentLine: string | null) => {
            if (currentEntity) {
                const filteredStations: StationList = Object.entries(allStations).reduce(
                    (acc, [stationName, stationData]) => {
                        if (stationData.lines.some((line) => line.startsWith(currentEntity))) {
                            acc[stationName] = stationData
                        }
                        return acc
                    },
                    {} as StationList
                )
                setPossibleStations(filteredStations)
            } else if (currentLine) {
                const filteredStations: StationList = Object.entries(allStations).reduce(
                    (acc, [stationName, stationData]) => {
                        if (stationData.lines.some((stationLine) => stationLine === currentLine)) {
                            acc[stationName] = stationData
                        }
                        return acc
                    },
                    {} as StationList
                )
                setPossibleStations(filteredStations)
            } else {
                setPossibleStations(allStations)
            }
        },
        [allStations]
    )

    const updatePossibleLines = useCallback(
        (currentEntity: string | null, currentLine: string | null) => {
            if (currentLine) {
                setPossibleLines({ [currentLine]: allLines[currentLine] })
            } else if (currentEntity) {
                const filteredLines: LinesList = Object.entries(allLines).reduce((acc, [line, stations]) => {
                    if (line.startsWith(currentEntity)) {
                        acc[line] = stations
                    }
                    return acc
                }, {} as LinesList)
                setPossibleLines(filteredLines)
            } else {
                setPossibleLines(allLines)
            }
        },
        [allLines]
    )

    const refreshForm = useCallback(
        (entity: string) => {
            setCurrentEntity(entity)
            setCurrentLine(null)
            updatePossibleLines(entity, null)
            updatePossibleStations(entity, null)
        },
        [updatePossibleLines, updatePossibleStations]
    )

    const handleEntitySelect = useCallback(
        (entity: string | null) => {
            if (entity) {
                refreshForm(entity)
            } else {
                setCurrentEntity(entity)
                updatePossibleLines(entity, currentLine)
                updatePossibleStations(entity, currentLine)
            }
        },
        [updatePossibleLines, updatePossibleStations, currentLine, refreshForm]
    )

    const handleLineSelect = useCallback(
        (line: string | null) => {
            if (line === null || line === currentLine) {
                setCurrentLine(null)
                updatePossibleStations(currentEntity, null)
            } else {
                setCurrentLine(line)
                updatePossibleStations(currentEntity, line)
            }
        },
        [updatePossibleStations, currentEntity, currentLine]
    )

    const handleStationSelect = useCallback((station: string | null) => {
        console.log('Selected Station:', station)
    }, [])

    return (
        <div className={`report-form container modal ${className}`}>
            <form>
                <h1>Neue Meldung</h1>
                <div>
                    <SelectField
                        containerClassName="align-child-on-line large-selector"
                        fieldClassName="entity-type-selector"
                        onSelect={handleEntitySelect}
                        value={currentEntity}
                    >
                        <div className="line U8">
                            <strong>U</strong>
                        </div>
                        <div className="line S2">
                            <strong>S</strong>
                        </div>
                    </SelectField>
                </div>
                <div>
                    <h2>Linie</h2>
                    <SelectField
                        containerClassName="align-child-on-line long-selector"
                        onSelect={handleLineSelect}
                        value={currentLine}
                    >
                        {Object.keys(possibleLines).map((line) => (
                            <div key={line} className={`line ${line}`}>
                                <strong>{line}</strong>
                            </div>
                        ))}
                    </SelectField>
                </div>
                <div>
                    <h2>Station</h2>
                    <SelectField onSelect={handleStationSelect} value={currentStation}>
                        {Object.keys(possibleStations).map((station) => (
                            <div key={station}>
                                <strong>{station}</strong>
                            </div>
                        ))}
                    </SelectField>
                </div>
            </form>
        </div>
    )
}

export default ReportForm
