import './UtilModal.css'

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAnalyticsOptOut } from '../../../hooks/useAnalyticsOptOut'
import { Backdrop } from '../../Miscellaneous/Backdrop/Backdrop'
import { ContactSection } from '../ContactSection/ContactSection'
import { LegalDisclaimer } from '../LegalDisclaimer'

interface UtilModalProps {
    className: string
    children?: React.ReactNode
}

const GITHUB_ICON = `/icons/github.svg`

const UtilModal: React.FC<UtilModalProps> = ({ className, children }) => {
    const { t } = useTranslation()
    const [isOptedOut, updateOptOut] = useAnalyticsOptOut()

    const [isContactModalOpen, setIsContactModalOpen] = useState(false)
    const [isLegalDisclaimerOpen, setIsLegalDisclaimerOpen] = useState(false)

    return (
        <>
            <div className={`util-modal info-popup modal ${className}`}>
                {children}
                <div className="modal-header">
                    <h1>{t('UtilModal.title')}</h1>
                    <button
                        className="action h-10 w-full rounded-sm"
                        onClick={() => setIsContactModalOpen(true)}
                        type="button"
                    >
                        {t('UtilModal.feedback-button')}
                    </button>
                </div>
                <div className="modal-content">
                    <div className="social-media-row">
                        <button className="social-media-button" type="button">
                            <img src={GITHUB_ICON} alt="GitHub Icon" />
                        </button>
                    </div>
                    <div className="links-row">
                        <Link to="/Datenschutz">{t('UtilModal.privacy')}</Link>
                        <button className="text-button" onClick={() => setIsLegalDisclaimerOpen(true)} type="button">
                            {t('UtilModal.terms')}
                        </button>
                    </div>
                    <div className="separator" />
                    <div className="toggle-switch">
                        <span className="toggle-switch__label">
                            {isOptedOut ? t('UtilModal.analytics-opted-out') : t('UtilModal.analytics-opted-in')}
                        </span>
                        <input
                            type="checkbox"
                            className="toggle-switch__input"
                            checked={!isOptedOut}
                            onChange={() => updateOptOut(!isOptedOut)}
                            aria-label={t('UtilModal.analytics-opted-out')}
                        />
                    </div>
                </div>
            </div>
            {isContactModalOpen ? (
                <>
                    <div className="contact-section modal open center-animation container">
                        <ContactSection />
                    </div>
                    <Backdrop handleClick={() => setIsContactModalOpen(false)} Zindex={3} />
                </>
            ) : null}
            {isLegalDisclaimerOpen ? (
                <>
                    <LegalDisclaimer handleConfirm={() => setIsLegalDisclaimerOpen(false)} />
                    <Backdrop handleClick={() => setIsLegalDisclaimerOpen(false)} Zindex={3} />
                </>
            ) : null}
        </>
    )
}

export { UtilModal }
