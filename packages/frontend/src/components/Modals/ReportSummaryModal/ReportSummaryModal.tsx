import React from 'react'
import './ReportSummaryModal.css'
import { Report } from '../../../utils/types'
import { useTranslation } from 'react-i18next'

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
                <div></div>
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
