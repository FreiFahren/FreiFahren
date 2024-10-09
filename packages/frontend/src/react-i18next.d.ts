import 'react-i18next'
import en from './locales/en.json'

type DefaultResources = typeof en
declare module 'react-i18next' {
    interface Resources extends DefaultResources {}
}
