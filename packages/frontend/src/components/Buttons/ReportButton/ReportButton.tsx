import React, { MouseEventHandler } from 'react'

import './ReportButton.css'

interface ReportButtonProps {
    openReportModal: MouseEventHandler<HTMLButtonElement>
}

const ReportButton: React.FC<ReportButtonProps> = ({ openReportModal }) => {
    return (
        <button className="report-button small-button align-child-on-line" onClick={openReportModal}>
            <p>Melden</p>
            <div className="plus">
                <span></span>
                <span></span>
            </div>
        </button>
    )
}

export default ReportButton
