import './ReportButton.css'

import React, { MouseEventHandler } from 'react'

interface ReportButtonProps {
    handleOpenReportModal: MouseEventHandler<HTMLButtonElement>
}

const ReportButton: React.FC<ReportButtonProps> = ({ handleOpenReportModal }) => (
        <button className="report-button small-button align-child-on-line" onClick={handleOpenReportModal} type="button">
            <p>Melden</p>
            <div className="plus">
                <span />
                <span />
            </div>
        </button>
    )

export { ReportButton }
