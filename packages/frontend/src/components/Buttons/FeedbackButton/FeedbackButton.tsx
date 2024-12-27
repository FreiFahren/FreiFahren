import './FeedbackButton.css'

import React from 'react'
import { useTranslation } from 'react-i18next'

interface FeedbackButtonProps {
    onClick: () => void
    className?: string
}

const FeedbackButton: React.FC<FeedbackButtonProps> = ({ onClick, className = '' }) => {
    const { t } = useTranslation()
    return (
        <button className={`feedback-button align-child-on-line ${className}`} onClick={onClick}>
            <img src={`${process.env.PUBLIC_URL}/icons/message-square-plus-svgrepo-com.svg`} alt="Feedback" />
            <p>{t('FeedbackButton.text')}</p>
        </button>
    )
}

export default FeedbackButton
