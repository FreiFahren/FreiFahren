/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
    const [currentDirection, setCurrentDirection] = useState<string | null>(null)
    const [description, setDescription] = useState<string>('')

    useEffect(() => {
        const fetchLinesAndStations = async () => {
            const [lines, stations] = await Promise.all([getAllLinesList(), getAllStationsList()])
            setAllLines(lines)
            setAllStations(stations)
        }
        fetchLinesAndStations()
    }, [])

    const possibleLines = useMemo(() => {
        if (!currentEntity) return allLines
        return Object.entries(allLines)
            .filter(([line]) => line.startsWith(currentEntity))
            .reduce((acc, [line, stations]) => {
                acc[line] = stations
                return acc
            }, {} as LinesList)
    }, [allLines, currentEntity])

    const possibleStations = useMemo(() => {
        if (currentStation) return { [currentStation]: allStations[currentStation] }
        if (currentLine) {
            return Object.entries(allStations)
                .filter(([, stationData]) => stationData.lines.includes(currentLine))
                .reduce((acc, [stationName, stationData]) => {
                    acc[stationName] = stationData
                    return acc
                }, {} as StationList)
        }
        if (currentEntity) {
            return Object.entries(allStations)
                .filter(([, stationData]) => stationData.lines.some((line) => line.startsWith(currentEntity)))
                .reduce((acc, [stationName, stationData]) => {
                    acc[stationName] = stationData
                    return acc
                }, {} as StationList)
        }
        return allStations
    }, [allStations, currentEntity, currentLine, currentStation])

    const handleEntitySelect = useCallback((entity: string | null) => {
        setCurrentEntity(entity)
        setCurrentLine(null)
        setCurrentStation(null)
        setCurrentDirection(null)
    }, [])

    const handleLineSelect = useCallback((line: string | null) => {
        setCurrentLine(line)
        setCurrentStation(null)
    }, [])

    const handleStationSelect = useCallback(
        (stationName: string | null) => {
            const foundStationEntry = Object.entries(allStations).find(
                ([, stationData]) => stationData.name === stationName
            )
            setCurrentStation(foundStationEntry ? foundStationEntry[0] : null)
        },
        [allStations]
    )

    const handleDirectionSelect = useCallback((direction: string | null) => {
        setCurrentDirection(direction)
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
                </div>
                {currentLine && (
                    <div>
                        <h3>Richtung</h3>
                        <SelectField
                            onSelect={handleDirectionSelect}
                            value={currentDirection}
                            containerClassName="align-child-on-line"
                        >
                            <div>
                                <strong>{allStations[allLines[currentLine][0]].name}</strong>
                            </div>
                            <div>
                                <strong>
                                    {allStations[allLines[currentLine][allLines[currentLine].length - 1]].name}
                                </strong>
                            </div>
                        </SelectField>
                    </div>
                )}
                <div className="description-field">
                    <h3>Beschreibung</h3>
                    <textarea
                        placeholder="Beschreibung"
                        onChange={(e) => setDescription(e.target.value)}
                        value={description}
                    />
                </div>
            </form>
        </div>
    )
}

export default ReportForm

//Todo:
// - Semantic HTML
// - More refactoring
// - better comments
// - Station Select is wider than Direction select
