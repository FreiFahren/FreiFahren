import './UtilModal.css'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Backdrop } from "../../Miscellaneous/Backdrop/Backdrop"
import { FeedbackModal } from '../FeedbackModal/FeedbackModal'
import { LegalDisclaimer } from '../LegalDisclaimer/LegalDisclaimer'

interface UtilModalProps {
    className: string
    children?: React.ReactNode
    colorTheme: string
    toggleColorTheme: () => void
}

const githubIcon = `${process.env.PUBLIC_URL}/icons/github.svg`
const lightIcon = `${process.env.PUBLIC_URL}/icons/light.svg`
const darkIcon = `${process.env.PUBLIC_URL}/icons/dark.svg`

export const UtilModal = ({ className, children, colorTheme, toggleColorTheme }: UtilModalProps) => {
    const { t } = useTranslation()

    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
    const [isLegalDisclaimerOpen, setIsLegalDisclaimerOpen] = useState(false)

    return (
        <>
            <div className={`util-modal info-popup modal ${className}`}>
                {children}
                <div className="align-child-on-line">
                    <h1>{t('UtilModal.title')}</h1>
                    {/* eslint-disable-next-line react/button-has-type */}
                    <button className="action" onClick={() => setIsFeedbackModalOpen(true)}>
                        {t('UtilModal.feedback-button')}
                    </button>
                </div>
                <div>
                    <ul>
                        <li>
                            {/* eslint-disable-next-line react/button-has-type */}
                            <button onClick={toggleColorTheme}>
                                {colorTheme === 'light' ? (
                                    <img src={lightIcon} alt="Light Icon" />
                                ) : (
                                    <img src={darkIcon} alt="Dark Icon" />
                                )}
                            </button>
                        </li>
                    </ul>
                    <ul className="align-child-on-line">
                        <li>
                            <Link to="/impressum">{t('UtilModal.impressum')}</Link>
                        </li>
                        <li>
                            <Link to="/Datenschutz">{t('UtilModal.privacy')}</Link>
                        </li>
                        <li>
                            {/* eslint-disable-next-line react/button-has-type */}
                            <button onClick={() => setIsLegalDisclaimerOpen(true)}>{t('UtilModal.terms')}</button>
                        </li>
                        <li>
                            <a
                                className="github-icon"
                                href="https://github.com/FreiFahren/FreiFahren"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <img src={githubIcon} alt="Github Icon" />
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
            {isFeedbackModalOpen && (
                <>
                    <FeedbackModal openAnimationClass="open center-animation" />
                    <Backdrop onClick={() => setIsFeedbackModalOpen(false)} Zindex={3} />
                </>
            )}
            {isLegalDisclaimerOpen && (
                <>
                    <LegalDisclaimer
                        closeModal={() => setIsLegalDisclaimerOpen(false)}
                        openAnimationClass="open center-animation high-z-index"
                    />
                    <Backdrop onClick={() => setIsLegalDisclaimerOpen(false)} Zindex={3} />
                </>
            )}
        </>
    )
}
