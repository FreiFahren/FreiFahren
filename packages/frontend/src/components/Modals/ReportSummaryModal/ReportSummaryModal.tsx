import './ReportSummaryModal.css'

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import FeedbackButton from 'src/components/Buttons/FeedbackButton/FeedbackButton'
import { FeedbackForm } from 'src/components/Form/FeedbackForm/FeedbackForm'

import { useCountAnimation } from '../../../hooks/useCountAnimation'
import { Report } from '../../../utils/types'
import { ShareButton } from '../../Miscellaneous/ShareButton/ShareButton'
import { ReportItem } from '../ReportsModal/ReportItem'

interface ReportSummaryModalProps {
    openAnimationClass?: string
    reportData: Report
    handleCloseModal: () => void
    numberOfUsers: number
}

const ReportSummaryModal: React.FC<ReportSummaryModalProps> = ({
    openAnimationClass,
    reportData,
    handleCloseModal,
    numberOfUsers,
}) => {
    const { t } = useTranslation()
    const animatedCount = useCountAnimation(numberOfUsers, 1.5 * 1000)

    const [showFeedback, setShowFeedback] = useState<boolean>(false)
    if (showFeedback) {
        return <FeedbackForm openAnimationClass={openAnimationClass} />
    }

    return (
        <div className={`report-summary-modal container modal ${openAnimationClass}`}>
            <FeedbackButton handleButtonClick={() => setShowFeedback(true)} />
            <div className="report-summary-modal-content">
                <div className="check-icon">
                    <img className="no-filter" src="/icons/risk-0.svg" alt="checkmark" />
                </div>
                <h1>{t('ReportSummaryModal.title')}</h1>
                <div>
                    <ReportItem key={reportData.station.id + reportData.timestamp} report={reportData} />
                    <ShareButton report={reportData} />
                </div>
                <span>
                    <img className="no-filter" src="/icons/users-svgrepo-com.svg" alt="users" />
                    <h1>{animatedCount}</h1>
                </span>
                <p>{t('ReportSummaryModal.description')}</p>
                <span className="disclaimer">{t('ReportSummaryModal.syncText')}</span>
                <button className="action" onClick={handleCloseModal} type="button">
                    {t('ReportSummaryModal.button')}
                </button>
            </div>
        </div>
    )
}

export { ReportSummaryModal }
