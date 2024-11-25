import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { noop } from 'lodash'
import { forwardRef, Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking } from 'react-native'

import { config } from '../../config'
import { track } from '../../tracking'
import { FFButton, FFSafeAreaView, FFText, FFView } from '../common/base'
import { FFScrollSheet } from '../common/FFSheet'

type DisclaimerProps = {
    onDismiss: () => void
}

export const Disclaimer = forwardRef(({ onDismiss }: DisclaimerProps, ref: Ref<BottomSheetModal>) => {
    const { t } = useTranslation('disclaimer')

    const openPrivacyPolicy = () => {
        track({ name: 'Privacy Policy Viewed', from: 'disclaimer' })
        Linking.openURL(config.PRIVACY_POLICY_URL).catch(noop)
    }

    return (
        <FFScrollSheet ref={ref} enablePanDownToClose={false} index={0}>
            <FFSafeAreaView justifyContent="space-between" flex={1} edges={['bottom']}>
                <FFView>
                    <FFText variant="header1">{t('title')}</FFText>
                    <FFText mt="xs">{t('subtitle')}</FFText>
                    <FFText variant="header3" mt="xs">
                        {t('bullet1.title')}
                    </FFText>
                    <FFText mt="xxs">{t('bullet1.text1')}</FFText>
                    <FFText mt="xxs">{t('bullet1.text2')}</FFText>
                    <FFText variant="header3" mt="xs">
                        {t('bullet2.title')}
                    </FFText>
                    <FFText mt="xxs">
                        {t('bullet2.text')}
                        <FFText style={{ textDecorationLine: 'underline' }} onPress={openPrivacyPolicy}>
                            {t('bullet2.privacyPolicy')}
                        </FFText>
                    </FFText>
                    <FFText mt="xs">{t('endText')}</FFText>
                </FFView>
                <FFButton variant="primary" onPress={onDismiss} marginTop="m">
                    <FFText variant="labelLarge" fontWeight="bold">
                        {t('confirm')}
                    </FFText>
                </FFButton>
            </FFSafeAreaView>
        </FFScrollSheet>
    )
})
