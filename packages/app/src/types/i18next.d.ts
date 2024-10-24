import de from '../assets/locales/de.json'

declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'common'
        resources: typeof de
    }
}
