import React from 'react'
import { useTranslation } from 'react-i18next'

import { sendAnalyticsEvent } from 'src/utils/analytics'

import './ReportsModalButton.css'

interface ReportsModalButtonProps {
    closeModal: () => void
}

const ReportsModalButton: React.FC<ReportsModalButtonProps> = ({ closeModal }) => {
    const { t } = useTranslation()

    const handleClick = () => {
        closeModal()
        sendAnalyticsEvent('ReportsModal opened', {})
    }

    return (
        <button className="list-button small-button align-child-on-line" onClick={handleClick}>
            <img className="svg" src={`${process.env.PUBLIC_URL}/icons/list.svg`} alt="list button" />
            <p>{t('InspectorListButton.label')}</p>
        </button>
    )
}

export default ReportsModalButton
