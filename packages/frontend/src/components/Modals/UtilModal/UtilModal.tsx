import './UtilModal.css'

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Backdrop } from '../../Miscellaneous/Backdrop/Backdrop'
import { ContactSection } from '../ContactSection/ContactSection'
import { LegalDisclaimer } from '../LegalDisclaimer/LegalDisclaimer'

interface UtilModalProps {
    className: string
    children?: React.ReactNode
    colorTheme: string
    handleColorThemeToggle: () => void
}

const GITHUB_ICON = `${process.env.PUBLIC_URL}/icons/github.svg`
const LIGHT_ICON = `${process.env.PUBLIC_URL}/icons/light.svg`
const DARK_ICON = `${process.env.PUBLIC_URL}/icons/dark.svg`

const UtilModal: React.FC<UtilModalProps> = ({ className, children, colorTheme, handleColorThemeToggle }) => {
    const { t } = useTranslation()

    const [isContactModalOpen, setIsContactModalOpen] = useState(false)
    const [isLegalDisclaimerOpen, setIsLegalDisclaimerOpen] = useState(false)

    return (
        <>
            <div className={`util-modal info-popup modal ${className}`}>
                {children}
                <div className="align-child-on-line">
                    <h1>{t('UtilModal.title')}</h1>
                    <button className="action" onClick={() => setIsContactModalOpen(true)} type="button">
                        {t('UtilModal.feedback-button')}
                    </button>
                </div>
                <div>
                    <ul>
                        <button className="theme-toggle" onClick={handleColorThemeToggle} type="button">
                            {colorTheme === 'light' ? (
                                <img src={LIGHT_ICON} alt="Light Icon" />
                            ) : (
                                <img src={DARK_ICON} alt="Dark Icon" />
                            )}
                        </button>
                    </ul>
                    <ul className="align-child-on-line">
                        <li>
                            <Link to="/Datenschutz">{t('UtilModal.privacy')}</Link>
                        </li>
                        <li>
                            <button
                                className="text-button"
                                onClick={() => setIsLegalDisclaimerOpen(true)}
                                type="button"
                            >
                                {t('UtilModal.terms')}
                            </button>
                        </li>
                        <li>
                            <a
                                className="github-icon"
                                href="https://github.com/FreiFahren/FreiFahren"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <img src={GITHUB_ICON} alt="Github Icon" />
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
            {isContactModalOpen ? (
                <>
                    <div className="contact-section modal container center-animation">
                        <ContactSection />
                    </div>
                    <Backdrop handleClick={() => setIsContactModalOpen(false)} Zindex={3} />
                </>
            ) : null}
            {isLegalDisclaimerOpen ? (
                <>
                    <LegalDisclaimer
                        openAnimationClass="open center-animation high-z-index"
                        handleConfirm={() => setIsLegalDisclaimerOpen(false)}
                    />
                    <Backdrop handleClick={() => setIsLegalDisclaimerOpen(false)} Zindex={3} />
                </>
            ) : null}
        </>
    )
}

export { UtilModal }
