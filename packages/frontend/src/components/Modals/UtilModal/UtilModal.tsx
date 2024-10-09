import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import './UtilModal.css'
import FeedbackModal from '../FeedbackModal/FeedbackModal'
import Backdrop from '../../../components/Miscellaneous/Backdrop/Backdrop'

interface UtilModalProps {
    className: string
    children?: React.ReactNode
    colorTheme: string
    toggleColorTheme: () => void
}

const github_icon = `${process.env.PUBLIC_URL}/icons/github.svg`
const light_icon = `${process.env.PUBLIC_URL}/icons/light.svg`
const dark_icon = `${process.env.PUBLIC_URL}/icons/dark.svg`

const UtilModal: React.FC<UtilModalProps> = ({ className, children, colorTheme, toggleColorTheme }) => {
    const { t } = useTranslation()

    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)

    return (
        <>
            <div className={`util-modal info-popup modal ${className}`}>
                {children}
                <div className="align-child-on-line">
                    <h1>{t('UtilModal.title')}</h1>
                    <button className="action" onClick={() => setIsFeedbackModalOpen(true)}>
                        {t('UtilModal.feedback-button')}
                    </button>
                </div>
                <div>
                    <ul>
                        <li onClick={toggleColorTheme}>
                            {colorTheme === 'light' ? (
                                <img src={light_icon} alt="Light Icon" />
                            ) : (
                                <img src={dark_icon} alt="Dark Icon" />
                            )}
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
                            <a
                                className="github-icon"
                                href="https://github.com/FreiFahren/FreiFahren"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <img src={github_icon} alt="Github Icon" />
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
            {isFeedbackModalOpen && (
                <>
                    <FeedbackModal openAnimationClass={isFeedbackModalOpen ? 'open center-animation' : ''} />
                    <Backdrop onClick={() => setIsFeedbackModalOpen(false)} Zindex={3} />
                </>
            )}
        </>
    )
}

export default UtilModal
