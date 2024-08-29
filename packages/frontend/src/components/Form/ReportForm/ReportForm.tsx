import React from 'react'
import './ReportForm.css'

import SelectField from '../SelectField/SelectField'
interface ReportFormProps {
    closeModal: () => void
    onFormSubmit: () => void
    className?: string
    userPosition?: { lat: number; lng: number } | null
}

const ReportForm: React.FC<ReportFormProps> = ({ closeModal, onFormSubmit, className, userPosition }) => {
    return (
        <div className={`report-form container modal ${className}`}>
            <form>
                <h1>Neue Meldung</h1>
                <div>
                    <SelectField
                        containerClassName="align-child-on-line large-selector"
                        fieldClassName="entity-type-selector"
                    >
                        <div className="entity U8">
                            <strong>U</strong>
                        </div>
                        <div className="entity S2">
                            <strong>S</strong>
                        </div>
                    </SelectField>
                </div>
            </form>
        </div>
    )
}

export default ReportForm
