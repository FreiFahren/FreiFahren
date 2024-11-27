import { useTranslation } from 'react-i18next'
import './LanguageSwitcher.css'

type LanguageSwitcherProps = {
    title: string
}

export const LanguageSwitcher = ({ title }: LanguageSwitcherProps) => {
    const { i18n } = useTranslation()

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'de' : 'en'
        i18n.changeLanguage(newLang)
    }

    return (
        <p onClick={toggleLanguage} className="language-switcher-link">
            {title}
        </p>
    )
}
