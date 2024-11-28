import './ReportButton.css'

import { MouseEventHandler } from 'react'

interface ReportButtonProps {
    openReportModal: MouseEventHandler<HTMLButtonElement>
}

export const ReportButton = ({ openReportModal }: ReportButtonProps) => (
    // eslint-disable-next-line react/button-has-type
    <button className="report-button small-button align-child-on-line" onClick={openReportModal}>
        <p>Melden</p>
        <div className="plus">
            <span />
            <span />
        </div>
    </button>
)
