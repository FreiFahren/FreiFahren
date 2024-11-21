import { Ionicons } from '@expo/vector-icons'
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import Constants from 'expo-constants'
import { noop } from 'lodash'
import { ComponentProps, forwardRef, Ref, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking } from 'react-native'

import { config } from '../../config'
import { track } from '../../tracking'
import { FFButton, FFText, FFView } from '../common/base'
import { FFCarousellSelect } from '../common/FFCarousellSelect'
import { FFScrollSheet } from '../common/FFSheet'

type Language = 'en' | 'de'

const LanguageSwitcher = () => {
    const { i18n, t } = useTranslation('settings')

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
        <FFView>
            <FFText variant="header2" mt="xs" mb="xxs">
                {t('language')}
            </FFText>
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

const SettingsSheet = forwardRef((_, ref: Ref<BottomSheetModalMethods>) => {
    const { t } = useTranslation('settings')

    const openPrivacyPolicy = () => {
        track({ name: 'Privacy Policy Viewed', from: 'settings' })
        Linking.openURL(config.PRIVACY_POLICY_URL).catch(noop)
    }

    const openSupportPage = () => {
        track({ name: 'Support Page Viewed', from: 'settings' })
        Linking.openURL(config.SUPPORT_URL).catch(noop)
    }

    return (
        <FFScrollSheet ref={ref}>
            <FFText variant="header1" color="fg">
                {t('title')}
            </FFText>
            <LanguageSwitcher />
            <FFView flexDirection="row" gap="xs">
                <FFText
                    style={{
                        textDecorationLine: 'underline',
                        marginTop: 16,
                        color: 'white',
                    }}
                    onPress={openPrivacyPolicy}
                >
                    {t('privacyPolicy')}
                </FFText>
                <FFText
                    style={{
                        textDecorationLine: 'underline',
                        marginTop: 16,
                        color: 'white',
                        fontFamily: 'Funnel Sans',
                    }}
                    onPress={openSupportPage}
                >
                    {t('support')}
                </FFText>
            </FFView>
            <FFText variant="small" textAlign="center" color="fg" mt="xs">
                v{Constants.expoConfig?.version ?? '0.0.1'}
            </FFText>
        </FFScrollSheet>
    )
})

export const SettingsButton = (props: ComponentProps<typeof FFButton>) => {
    const sheetRef = useRef<BottomSheetModalMethods>(null)

    const handleOpen = () => {
        track({ name: 'Settings Opened' })
        sheetRef.current?.present()
    }

    return (
        <>
            <SettingsSheet ref={sheetRef} />
            <FFButton variant="square" onPress={handleOpen} {...props}>
                <Ionicons name="settings-sharp" size={24} color="white" />
            </FFButton>
        </>
    )
}
