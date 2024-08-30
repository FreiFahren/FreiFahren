import React, { useState, useEffect } from 'react'
import './ReportForm.css'

import SelectField from '../SelectField/SelectField'
import { getAllLinesList, LinesList } from '../../../utils/dbUtils'
interface ReportFormProps {
    closeModal: () => void
    onFormSubmit: () => void
    className?: string
    userPosition?: { lat: number; lng: number } | null
}

const ReportForm: React.FC<ReportFormProps> = ({ closeModal, onFormSubmit, className, userPosition }) => {
    const [selectedEntity, setSelectedEntity] = useState<string | null>(null)
    const [allLines, setAllLines] = useState<LinesList>({})
    const [possibleLines, setPossibleLines] = useState<LinesList>({})

    useEffect(() => {
        const fetchLines = async () => {
            const lines = await getAllLinesList()
            setAllLines(lines)
            setPossibleLines(lines) // Initialize possibleLines with all lines
        }
        fetchLines()
    }, [])

    useEffect(() => {
        if (selectedEntity) {
            const filteredLines: LinesList = Object.entries(allLines).reduce((acc, [line, stations]) => {
                if (line.startsWith(selectedEntity)) {
                    acc[line] = stations
                }
                return acc
            }, {} as LinesList)
            setPossibleLines(filteredLines)
        } else {
            setPossibleLines(allLines)
        }
    }, [selectedEntity, allLines])

    const handleEntitySelect = (entity: string) => {
        setSelectedEntity(entity)
        console.log(selectedEntity)
        console.log(possibleLines)
    }

    return (
        <div className={`report-form container modal ${className}`}>
            <form>
                <h1>Neue Meldung</h1>
                <div>
                    <SelectField
                        containerClassName="align-child-on-line large-selector"
                        fieldClassName="entity-type-selector"
                        onSelect={handleEntitySelect}
                    >
                        <div className="entity U8">
                            <strong>U</strong>
                        </div>
                        <div className="entity S2">
                            <strong>S</strong>
                        </div>
                    </SelectField>
                </div>
                <div>
                    <h2>Linie</h2>
                </div>
            </form>
        </div>
    )
}

export default ReportForm
