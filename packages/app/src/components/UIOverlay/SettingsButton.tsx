import { Ionicons } from '@expo/vector-icons'
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import Constants from 'expo-constants'
import { noop } from 'lodash'
import { ComponentProps, forwardRef, Ref, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking } from 'react-native'

import { config } from '../../config'
import { useTracking } from '../../tracking/provider'
import { FFButton, FFText, FFView } from '../common/base'
import { FFScrollSheet } from '../common/FFSheet'
import { LanguageSwitcher } from '../common/LanguageSwitcher'

const SettingsSheet = forwardRef((_, ref: Ref<BottomSheetModalMethods>) => {
    const { t } = useTranslation('settings')
    const { track } = useTracking()

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
            <FFText variant="header2" mt="xs" mb="xxs">
                {t('language')}
            </FFText>
            <LanguageSwitcher />
            <FFView flexDirection="row" gap="xs" mt="s">
                <FFText variant="body" color="darkText" textDecorationLine="underline" onPress={openPrivacyPolicy}>
                    {t('privacyPolicy')}
                </FFText>
                <FFText variant="body" color="darkText" textDecorationLine="underline" onPress={openSupportPage}>
                    {t('support')}
                </FFText>
            </FFView>
            <FFText variant="small" color="darkText" textAlign="center" mt="xs">
                v{Constants.expoConfig?.version ?? '0.0.1'}
                {` (${__DEV__ ? 'Dev' : 'Release'})`}
            </FFText>
        </FFScrollSheet>
    )
})

export const SettingsButton = (props: ComponentProps<typeof FFButton>) => {
    const sheetRef = useRef<BottomSheetModalMethods>(null)
    const { track } = useTracking()

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
