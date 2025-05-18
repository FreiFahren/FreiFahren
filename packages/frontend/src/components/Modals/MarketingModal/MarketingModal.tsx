import React from 'react'
import './MarketingModal.css'
import { useTranslation } from 'react-i18next'

interface MarketingModalProps {
    className?: string
    children?: React.ReactNode
}

const MarketingModal: React.FC<MarketingModalProps> = ({ className, children }) => {
    const { t } = useTranslation()

    return (
        <div className={`marketing-modal info-popup modal ${className}`}>
            {children}
            <div className="marketing-modal-content">
                <h1>{t('MarketingModal.title')}</h1>
                <h2>{t('MarketingModal.subtitle')}</h2>
                <p>{t('MarketingModal.description')}</p>
                <button type="submit">{t('MarketingModal.button')}</button>
            </div>
        </div>
    )
}

export default MarketingModal
