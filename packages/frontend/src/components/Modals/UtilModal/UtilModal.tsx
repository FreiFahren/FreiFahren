import React, { useState } from 'react'
import { Link } from 'react-router-dom'

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
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)

    return (
        <>
            <div className={`util-modal info-popup modal ${className}`}>
                {children}
                <div className="align-child-on-line">
                    <h1>Informationen</h1>
                    <button className="action" onClick={() => setIsFeedbackModalOpen(true)}>
                        Kontakt & Feedback
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
                            <Link to="/impressum">Impressum</Link>
                        </li>
                        <li>
                            <Link to="/Datenschutz">Datenschutz</Link>
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
