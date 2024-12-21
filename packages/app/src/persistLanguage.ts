import i18next from 'i18next'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppStore } from './app.store'

export const usePersistLanguage = () => {
    const { i18n } = useTranslation()
    const { language, update } = useAppStore((state) => ({ language: state.language, update: state.update }))

    useEffect(() => {
        const handleLanguageChanged = (lng: string) => {
            if (lng !== language) {
                update({ language: lng })
            }
        }

        i18next.on('languageChanged', handleLanguageChanged)
        return () => i18next.off('languageChanged', handleLanguageChanged)
    }, [language, update])

    useEffect(() => {
        if (language === null) {
            return
        }
        i18n.changeLanguage(language).catch((error) => {
            // eslint-disable-next-line no-console
            console.error("Couldn't change language: ", error)
        })
    }, [language, i18n])
}
