import { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'

import { track } from '../../tracking'
import { FFText, FFView } from './base'
import { FFCarousellSelect } from './FFCarousellSelect'

type Language = 'en' | 'de'

export const LanguageSwitcher = (props: ComponentProps<typeof FFView>) => {
    const { i18n } = useTranslation('settings')

    const languages = {
        de: '🇩🇪 Deutsch',
        en: '🇬🇧 English',
    } as const

    const handleSelect = (item: Language) => {
        track({ name: 'Language Switched', language: item })
        // eslint-disable-next-line no-console
        i18n.changeLanguage(item).catch(console.error)
    }

    return (
        <FFView {...props}>
            <FFCarousellSelect
                hideCheck
                options={['en', 'de'] as const}
                renderOption={(item: Language) => <FFText variant="label">{languages[item]}</FFText>}
                selectedOption={i18n.language as Language}
                onSelect={handleSelect}
            />
        </FFView>
    )
}
