import './MarketingModal.css'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { sendAnalyticsEvent } from 'src/hooks/useAnalytics'

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
                <button
                    type="submit"
                    onClick={() => sendAnalyticsEvent('redirected to app store', {})}
                    className="h-10 w-full rounded-md p-2"
                >
                    <a
                        href="https://apps.apple.com/de/app/freifahren/id6738277309"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {t('MarketingModal.button')}
                    </a>
                </button>
            </div>
        </div>
    )
}

export default MarketingModal
