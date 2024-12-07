import React from 'react'
import './ReportSummaryModal.css'
import { Report } from '../../../utils/types'

interface ReportSummaryModalProps {
    openAnimationClass?: string
    reportData: Report
}

const ReportSummaryModal: React.FC<ReportSummaryModalProps> = ({ openAnimationClass, reportData }) => {
    return (
        <div className={`report-summary-modal container modal ${openAnimationClass}`}>
            <p>{reportData.station.name}</p>
            <p>{reportData.direction?.name}</p>
            <p>{reportData.line}</p>
            <p>{reportData.message}</p>
        </div>
    )
}

export default ReportSummaryModal
