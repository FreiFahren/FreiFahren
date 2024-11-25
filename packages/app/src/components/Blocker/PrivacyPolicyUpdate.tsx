import { Feather } from '@expo/vector-icons'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { noop } from 'lodash'
import { forwardRef, Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking } from 'react-native'

import { config } from '../../config'
import { track } from '../../tracking'
import { FFButton, FFSafeAreaView, FFText, FFView } from '../common/base'
import { FFScrollSheet } from '../common/FFSheet'

type PrivacyPolicyUpdateProps = {
    onDismiss: () => void
}

export const PrivacyPolicyUpdate = forwardRef(({ onDismiss }: PrivacyPolicyUpdateProps, ref: Ref<BottomSheetModal>) => {
    const { t } = useTranslation('privacyPolicyUpdated')

    const openPrivacyPolicy = () => {
        track({ name: 'Privacy Policy Viewed', from: 'update-sheet' })
        Linking.openURL(config.PRIVACY_POLICY_URL).catch(noop)
    }

    return (
        <FFScrollSheet ref={ref} enablePanDownToClose={false} index={0}>
            <FFSafeAreaView justifyContent="space-between" flex={1} edges={['bottom']}>
                <FFView>
                    <FFText variant="header1">{t('title')}</FFText>
                    <FFText mt="xs">{t('text')}</FFText>
                    <FFText fontFamily="Funnel Sans SemiBold" mt="xs">
                        {t('confirmText')}
                    </FFText>
                    <FFView flexDirection="row" alignItems="center" mt="xs">
                        <Feather name="arrow-right" size={16} color="white" />
                        <FFText textDecorationLine="underline" onPress={openPrivacyPolicy} ml="xxs">
                            {t('link')}
                        </FFText>
                    </FFView>
                </FFView>
                <FFButton onPress={onDismiss} variant="primary" label={t('confirm')} mt="m" />
            </FFSafeAreaView>
        </FFScrollSheet>
    )
})
