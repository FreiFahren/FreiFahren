import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import './LegalDisclaimer.css'

interface LegalDisclaimerProps {
    closeModal: () => void
    openAnimationClass?: string
}

const LegalDisclaimer: React.FC<LegalDisclaimerProps> = ({ closeModal, openAnimationClass }) => {
    const { t } = useTranslation()

    return (
        <div className={`legal-disclaimer container modal ${openAnimationClass}`} id="legal-disclaimer">
            <div className="content">
                <h1>{t('LegalDisclaimer.title')}</h1>
                <section>
                    <p>{t('LegalDisclaimer.text')}</p>
                    <ol>
                        <li>
                            <strong>{t('LegalDisclaimer.ticket')}</strong>
                            <p>{t('LegalDisclaimer.ticketDescription')}</p>
                        </li>
                        <li>
                            <strong>{t('LegalDisclaimer.activeUsage')}</strong>
                            <p>{t('LegalDisclaimer.activeUsageDescription')}</p>
                        </li>
                    </ol>
                    <p>{t('LegalDisclaimer.saved')}</p>
                </section>
            </div>
            <div className="footer">
                <button onClick={closeModal}>{t('LegalDisclaimer.confirm')}</button>
                <ul className="align-child-on-line">
                    <li>
                        <Link to="/impressum">{t('LegalDisclaimer.impressum')}</Link>
                    </li>
                    <li>
                        <Link to="/Datenschutz">{t('LegalDisclaimer.privacy')}</Link>
                    </li>
                </ul>
            </div>
        </div>
    )
}

export default LegalDisclaimer
