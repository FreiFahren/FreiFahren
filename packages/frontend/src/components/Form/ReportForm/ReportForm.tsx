import React from 'react'
import './ReportForm.css'

interface ReportFormProps {
    closeModal: () => void
    onFormSubmit: () => void
    className?: string
    userPosition?: { lat: number; lng: number } | null
}

const ReportForm: React.FC<ReportFormProps> = ({ closeModal, onFormSubmit, className, userPosition }) => {
    return <div className={`report-form container modal ${className}`}></div>
}

export default ReportForm
