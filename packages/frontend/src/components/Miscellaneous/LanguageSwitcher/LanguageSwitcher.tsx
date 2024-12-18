import './LanguageSwitcher.css'

import { useTranslation } from 'react-i18next'

type LanguageSwitcherProps = {
    title: string
}

export const LanguageSwitcher = ({ title }: LanguageSwitcherProps) => {
    const { i18n } = useTranslation()

    const handleLanguageChange = () => {
        const newLang = i18n.language === 'en' ? 'de' : 'en'

        i18n.changeLanguage(newLang).catch((error) => {
            // fix this later with sentry
            // eslint-disable-next-line no-console
            console.error('Error changing language', error)
        })
    }

    return (
        // fix this later please, why button as div 
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions
        <p onClick={handleLanguageChange} className="language-switcher-link">
            {title}
        </p>
    )
}
