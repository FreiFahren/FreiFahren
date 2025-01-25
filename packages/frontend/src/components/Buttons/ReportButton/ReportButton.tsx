import './ReportButton.css'

import React, { MouseEventHandler } from 'react'
import { useTranslation } from 'react-i18next'

interface ReportButtonProps {
    handleOpenReportModal: MouseEventHandler<HTMLButtonElement>
}

const ReportButton: React.FC<ReportButtonProps> = ({ handleOpenReportModal }) => {
    const { t } = useTranslation()

    return (
        <button
            className="report-button small-button align-child-on-line"
            onClick={handleOpenReportModal}
            type="button"
        >
            <p>{t('reportButton.label')}</p>
            <div className="plus">
                <span />
                <span />
            </div>
        </button>
    )
}

export { ReportButton }
