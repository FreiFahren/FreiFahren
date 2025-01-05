import './FeedbackSummaryModal.css'

import { FC } from 'react'
import { useTranslation } from 'react-i18next'

interface FeedbackSummaryModalProps {
    openAnimationClass?: string
    handleCloseModal: () => void
}

const FeedbackSummaryModal: FC<FeedbackSummaryModalProps> = ({ openAnimationClass, handleCloseModal }) => {
    const { t } = useTranslation()

    const handleJoinTelegram = () => {
        window.open('https://t.me/+GWijyFkCHgwwMDVi', '_blank')
        handleCloseModal()
    }

    return (
        <div className={`feedback-summary-modal container modal ${openAnimationClass}`}>
            <div className="feedback-summary-modal-content">
                <div className="check-icon">
                    <img className="no-filter" src={`${process.env.PUBLIC_URL}/icons/risk-0.svg`} alt="checkmark" />
                </div>
                <h1>{t('FeedbackSummaryModal.title')}</h1>
                <p>{t('FeedbackSummaryModal.description')}</p>
                <div className="button-group">
                    <button className="action align-child-on-line" onClick={handleJoinTelegram} type="button">
                        <img src={`${process.env.PUBLIC_URL}/icons/telegram.svg`} alt="telegram" />
                        <span>{t('FeedbackSummaryModal.joinGroup')}</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

export { FeedbackSummaryModal }
