import React from 'react'

import { Report } from '../../../utils/types'
import { useTranslation } from 'react-i18next'

import ReportItem from '../ReportsModal/ReportItem'
import ShareButton from '../../Miscellaneous/ShareButton/ShareButton'

import './ReportSummaryModal.css'

interface ReportSummaryModalProps {
    openAnimationClass?: string
    reportData: Report
    closeModal: () => void
}

const ReportSummaryModal: React.FC<ReportSummaryModalProps> = ({ openAnimationClass, reportData, closeModal }) => {
    const { t } = useTranslation()

    return (
        <div className={`report-summary-modal container modal ${openAnimationClass}`}>
            <div className="report-summary-modal-content">
                <h1>{t('ReportSummaryModal.title')}</h1>
                <div>
                    <ReportItem key={reportData.station.id + reportData.timestamp} ticketInspector={reportData} />
                    <ShareButton report={reportData} />
                </div>
                <span>
                    <img src={process.env.PUBLIC_URL + '/icons/users-svgrepo-com.svg'} alt="check" />
                    <h1>35.000</h1>
                </span>
                <p>{t('ReportSummaryModal.description')}</p>
                <button className="action" onClick={closeModal}>
                    {t('ReportSummaryModal.button')}
                </button>
            </div>
        </div>
    )
}

export default ReportSummaryModal
