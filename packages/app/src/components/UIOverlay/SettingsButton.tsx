import { Ionicons } from '@expo/vector-icons'
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { Text, View } from 'native-base'
import { ComponentProps, forwardRef, Ref, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import Constants from 'expo-constants'

import { FFButton } from '../common/FFButton'
import { FFCarousellSelect } from '../common/FFCarousellSelect'
import { FFScrollSheet } from '../common/FFSheet'
import { Linking } from 'react-native'
import { config } from '../../config'

type Language = 'en' | 'de'

const LanguageSwitcher = () => {
    const { i18n, t } = useTranslation('settings')

    const languages = {
        de: '🇩🇪 Deutsch',
        en: '🇬🇧 English',
    } as const

    return (
        <View>
            <Text fontSize="lg" color="white" bold mt="4" mb="2">
                {t('language')}
            </Text>
            <FFCarousellSelect
                hideCheck
                options={['en', 'de'] as const}
                renderOption={(item: Language) => (
                    <View px="6" py="2">
                        <Text color="white" bold>
                            {languages[item]}
                        </Text>
                    </View>
                )}
                selectedOption={i18n.language as Language}
                onSelect={(item) => i18n.changeLanguage(item)}
            />
        </View>
    )
}

const SettingsSheet = forwardRef((_, ref: Ref<BottomSheetModalMethods>) => {
    const { t } = useTranslation('settings')

    const openPrivacyPolicy = () => {
        Linking.openURL(config.PRIVACY_POLICY_URL)
    }

    return (
        <FFScrollSheet ref={ref}>
            <Text fontSize="xl" color="white" bold>
                {t('title')}
            </Text>
            <LanguageSwitcher />
            <Text
                style={{
                    textDecorationLine: 'underline',
                    marginTop: 16,
                    color: 'white',
                }}
                onPress={openPrivacyPolicy}
            >
                Datenschutzerklärung
            </Text>
            <Text fontSize="xs" textAlign="center" color="fg" mt={12}>
                v{Constants.expoConfig?.version ?? '0.0.133'}
            </Text>
        </FFScrollSheet>
    )
})

export const SettingsButton = (props: ComponentProps<typeof FFButton>) => {
    const sheetRef = useRef<BottomSheetModalMethods>(null)

    return (
        <>
            <SettingsSheet ref={sheetRef} />
            <FFButton onPress={() => sheetRef.current?.present()} {...props}>
                <Ionicons name="settings-sharp" size={24} color="white" />
            </FFButton>
        </>
    )
}
