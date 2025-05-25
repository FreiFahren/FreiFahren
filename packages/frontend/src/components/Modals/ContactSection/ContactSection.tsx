import './ContactSection.css'

import { FC } from 'react'
import { useTranslation } from 'react-i18next'

const GITHUB_ICON = `/icons/github.svg`
const MAIL_ICON = `/icons/mail.svg`
const TELEGRAM_ICON = `/icons/telegram.svg`

const ContactSection: FC = () => {
    const { t } = useTranslation()

    return (
        <div className="contact-section">
            <h2>{t('ContactSection.title')}</h2>
            <ul>
                <li>
                    <img
                        className="profile-picture"
                        src={`/icons/profiles/johan.jpeg`}
                        alt="Johan Trieloff Github Profile"
                    />
                    <p>Johan Trieloff</p>
                    <div>
                        <a href="https://t.me/jooooooohan">
                            <img src={TELEGRAM_ICON} alt="telegram icon" />
                        </a>
                        <a href="mailto:johan@trieloff.net">
                            <img src={MAIL_ICON} alt="mail icon" />
                        </a>
                        <a href="https://github.com/johan-t" target="_blank" rel="noopener noreferrer">
                            <img src={GITHUB_ICON} alt="github icon" />
                        </a>
                    </div>
                </li>
                <li>
                    <img className="profile-picture" src={`/icons/profiles/joff.jpeg`} alt="Joff Github Profile" />
                    <p>Joff</p>
                    <div>
                        <a href="mailto:mail@jfsalzmann.com">
                            <img src={MAIL_ICON} alt="mail icon" />
                        </a>
                        <a href="https://github.com/jfsalzmann" target="_blank" rel="noopener noreferrer">
                            <img src={GITHUB_ICON} alt="github icon" />
                        </a>
                    </div>
                </li>
                <li>
                    <img className="profile-picture" src={`/icons/profiles/moritz.jpeg`} alt="Moritz Github Profile" />
                    <p>Moritz</p>
                    <div>
                        <a href="maito:moritzamando@proton.me">
                            <img src={MAIL_ICON} alt="mail icon" />
                        </a>
                        <a href="https://github.com/mclrc" target="_blank" rel="noopener noreferrer">
                            <img src={GITHUB_ICON} alt="github icon" />
                        </a>
                    </div>
                </li>
                <li>
                    <img className="profile-picture" src={`/icons/profiles/david.jpeg`} alt="David Github Profile" />
                    <p>David</p>
                    <div>
                        <a href="https://github.com/brandesdavid" target="_blank" rel="noopener noreferrer">
                            <img src={GITHUB_ICON} alt="github icon" />
                        </a>
                    </div>
                </li>
            </ul>
            <h2>{t('ContactSection.about-us')}</h2>
            <p>
                {t('ContactSection.about-us-text')}{' '}
                <a href="https://github.com/FreiFahren/FreiFahren" target="_blank" rel="noopener noreferrer">
                    GitHub
                </a>
                .
            </p>
            <p>{t('ContactSection.telegram-group-info', { groupName: t('ContactSection.group-name') })}</p>
        </div>
    )
}

export { ContactSection }
