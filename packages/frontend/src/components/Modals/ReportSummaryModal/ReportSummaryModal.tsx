import React from 'react'
import './ReportSummaryModal.css'
import { simplifiedMarkerData } from '../../../utils/types'

interface ReportSummaryModalProps {
    openAnimationClass?: string
    reportData: simplifiedMarkerData
}

const ReportSummaryModal: React.FC<ReportSummaryModalProps> = ({ openAnimationClass, reportData }) => {
    return (
        <div className={`report-summary-modal container modal ${openAnimationClass}`}>
            <p>{reportData.station}</p>
            <p>{reportData.direction}</p>
            <p>{reportData.line}</p>
            <p>{reportData.message}</p>
        </div>
    )
}

export default ReportSummaryModal
