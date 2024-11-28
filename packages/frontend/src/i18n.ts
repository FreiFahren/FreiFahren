import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import Backend from 'i18next-http-backend'
import { initReactI18next } from 'react-i18next'

i18n.use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        supportedLngs: ['en', 'de'],
        backend: {
            loadPath: '/locales/{{lng}}.json',
        },
        interpolation: {
            escapeValue: false, // React already escapes values, no need for i18n to do so
        },
    })
    .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('i18n initialization error:', err)
    })
// eslint-disable-next-line import/no-default-export
export default i18n
