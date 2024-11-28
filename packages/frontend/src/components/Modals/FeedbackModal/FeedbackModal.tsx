import './FeedbackModal.css'

import { useTranslation } from 'react-i18next'

interface FeedbackModalProps {
    openAnimationClass?: string
}

const githubIcon = `${process.env.PUBLIC_URL}/icons/github.svg`
const mailIcon = `${process.env.PUBLIC_URL}/icons/mail.svg`
const telegramIcon = `${process.env.PUBLIC_URL}/icons/telegram.svg`

export const FeedbackModal = ({ openAnimationClass }: FeedbackModalProps) => {
    const { t } = useTranslation()

    return (
        <div className={`feedback-modal modal container ${openAnimationClass}`}>
            <h1>{t('FeedbackModal.title')}</h1>
            <ul>
                <li>
                    <img
                        className="profile-picture"
                        src={`${process.env.PUBLIC_URL}/icons/profiles/johan.jpeg`}
                        alt="Johan Github Profile"
                    />
                    <p>Johan</p>
                    <div>
                        <a href="https://t.me/jooooooohan">
                            <img src={telegramIcon} alt="telegram icon" />
                        </a>
                        <a href="mailto:johan@trieloff.net">
                            <img src={mailIcon} alt="mail icon" />
                        </a>
                        <a href="https://github.com/johan-t" target="_blank" rel="noopener noreferrer">
                            <img src={githubIcon} alt="github icon" />
                        </a>
                    </div>
                </li>
                <li>
                    <img
                        className="profile-picture"
                        src={`${process.env.PUBLIC_URL}/icons/profiles/joff.jpeg`}
                        alt="Joff Github Profile"
                    />
                    <p>Joff</p>
                    <div>
                        <a href="mailto:mail@jfsalzmann.com">
                            <img src={mailIcon} alt="mail icon" />
                        </a>
                        <a href="https://github.com/jfsalzmann" target="_blank" rel="noopener noreferrer">
                            <img src={githubIcon} alt="github icon" />
                        </a>
                    </div>
                </li>
                <li>
                    <img
                        className="profile-picture"
                        src={`${process.env.PUBLIC_URL}/icons/profiles/moritz.jpeg`}
                        alt="Moritz Github Profile"
                    />
                    <p>Moritz</p>
                    <div>
                        <a href="maito:moritzamando@proton.me">
                            <img src={mailIcon} alt="mail icon" />
                        </a>
                        <a href="https://github.com/mclrc" target="_blank" rel="noopener noreferrer">
                            <img src={githubIcon} alt="github icon" />
                        </a>
                    </div>
                </li>
                <li>
                    <img
                        className="profile-picture"
                        src={`${process.env.PUBLIC_URL}/icons/profiles/david.jpeg`}
                        alt="David Github Profile"
                    />
                    <p>David</p>
                    <div>
                        <a href="https://github.com/brandesdavid" target="_blank" rel="noopener noreferrer">
                            <img src={githubIcon} alt="github icon" />
                        </a>
                    </div>
                </li>
            </ul>
            <h2>{t('FeedbackModal.about-us')}</h2>
            <p>
                {t('FeedbackModal.about-us-text')}{' '}
                <a href="https://github.com/FreiFahren/FreiFahren" target="_blank" rel="noopener noreferrer">
                    GitHub
                </a>
                .
            </p>
            <p>{t('FeedbackModal.telegram-group-info', { groupName: t('FeedbackModal.group-name') })}</p>
        </div>
    )
}
