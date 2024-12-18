import './ReportSummaryModal.css'

import React from 'react'
import { useTranslation } from 'react-i18next'

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
    const animatedCount = useCountAnimation(numberOfUsers, 2 * 1000)

    return (
        <div className={`report-summary-modal container modal ${openAnimationClass}`}>
            <div className="report-summary-modal-content">
                <div>
                    <img className="no-filter" src={`${process.env.PUBLIC_URL  }/icons/risk-0.svg`} alt="checkmark" />
                </div>
                <h1>{t('ReportSummaryModal.title')}</h1>
                <div>
                    <ReportItem key={reportData.station.id + reportData.timestamp} report={reportData} />
                    <ShareButton report={reportData} />
                </div>
                <span>
                    <img
                        className="no-filter"
                        src={`${process.env.PUBLIC_URL  }/icons/users-svgrepo-com.svg`}
                        alt="users"
                    />
                    <h1>{animatedCount}</h1>
                </span>
                <p>{t('ReportSummaryModal.description')}</p>
                <button className="action" onClick={handleCloseModal} type="button">
                    {t('ReportSummaryModal.button')}
                </button>
            </div>
        </div>
    )
}

export { ReportSummaryModal }
