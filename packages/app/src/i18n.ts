// eslint-disable-next-line import/no-namespace
import * as Localization from 'expo-localization'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import de from '../assets/locales/de.json'
import en from '../assets/locales/en.json'

i18n.use(initReactI18next)
    .init({
        lng: Localization.locale.slice(0, 2), // Automatically use device locale
        fallbackLng: 'en',
        ns: Object.keys(de),
        defaultNS: 'common',
        resources: { de, en },
        supportedLngs: ['de', 'en'],
    })
    .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to initialize i18n: ', err)
    })

// eslint-disable-next-line import/no-default-export
export default i18n
