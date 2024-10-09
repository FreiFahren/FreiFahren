import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import Backend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

i18n.use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        supportedLngs: ['en', 'de'],
        backend: {
            loadPath: '/locales/{{lng}}.json', // Path to translation files
        },
        interpolation: {
            escapeValue: false, // React already escapes values, no need for i18n to do so
        },
    })

export default i18n
