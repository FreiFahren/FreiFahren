import './ContactSection.css'

import React, { FC } from 'react'
import { useTranslation } from 'react-i18next'

const GITHUB_ICON = `${process.env.PUBLIC_URL}/icons/github.svg`
const MAIL_ICON = `${process.env.PUBLIC_URL}/icons/mail.svg`
const TELEGRAM_ICON = `${process.env.PUBLIC_URL}/icons/telegram.svg`

const ContactSection: FC = () => {
    const { t } = useTranslation()

    return (
        <>
            <h1>{t('ContactSection.title')}</h1>
            <ul>
                <li>
                    <img
                        className="profile-picture"
                        src={`${process.env.PUBLIC_URL}/icons/profiles/johan.jpeg`}
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
                    <img
                        className="profile-picture"
                        src={`${process.env.PUBLIC_URL}/icons/profiles/joff.jpeg`}
                        alt="Joff Github Profile"
                    />
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
                    <img
                        className="profile-picture"
                        src={`${process.env.PUBLIC_URL}/icons/profiles/moritz.jpeg`}
                        alt="Moritz Github Profile"
                    />
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
                    <img
                        className="profile-picture"
                        src={`${process.env.PUBLIC_URL}/icons/profiles/david.jpeg`}
                        alt="David Github Profile"
                    />
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
        </>
    )
}

export { ContactSection }
