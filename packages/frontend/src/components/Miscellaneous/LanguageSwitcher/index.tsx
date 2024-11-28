import "./index.css"

import { useTranslation } from "react-i18next";

type LanguageSwitcherProps = {
    title: string;
}

export const LanguageSwitcher = ({ title }: LanguageSwitcherProps) => {
    const { i18n } = useTranslation();

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'de' : 'en';

        i18n.changeLanguage(newLang).catch((error) => {
            // eslint-disable-next-line no-console
            console.error('Error changing language', error);
        });
    };

    return (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
        <p onClick={toggleLanguage} className="language-switcher-link" >
            {title}
        </p>
    );
};
