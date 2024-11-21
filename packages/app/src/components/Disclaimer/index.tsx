import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { noop, pick } from 'lodash'
import { DateTime, Duration } from 'luxon'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking } from 'react-native'

import { useAppStore } from '../../app.store'
import { config } from '../../config'
import { track } from '../../tracking'
import { FFButton, FFSafeAreaView, FFText, FFView } from '../common/base'
import { FFScrollSheet } from '../common/FFSheet'

const DISCLAIMER_INTERVAL = Duration.fromObject({ days: 7 })

export const Disclaimer = () => {
    const { dismissedDisclaimerAt, disclaimerGood, update } = useAppStore((state) =>
        pick(state, ['dismissedDisclaimerAt', 'disclaimerGood', 'update'])
    )
    const sheetRef = useRef<BottomSheetModal>(null)
    const { t } = useTranslation('disclaimer')

    useEffect(() => {
        sheetRef.current?.present()
    }, [])

    useEffect(() => {
        if (dismissedDisclaimerAt !== null) {
            const now = DateTime.now()
            const dismissedAtDate = DateTime.fromISO(dismissedDisclaimerAt)

            if (Math.abs(now.diff(dismissedAtDate).as('days')) <= DISCLAIMER_INTERVAL.as('days')) {
                update({ disclaimerGood: true })
                return
            }
        }
        track({ name: 'Disclaimer Viewed' })
    }, [dismissedDisclaimerAt, update])

    if (disclaimerGood) {
        return null
    }

    const onDismiss = () => {
        track({ name: 'Disclaimer Dismissed' })
        update({ dismissedDisclaimerAt: DateTime.now().toISO() })
        sheetRef.current?.dismiss()
    }

    const openPrivacyPolicy = () => {
        track({ name: 'Privacy Policy Viewed', from: 'disclaimer' })
        Linking.openURL(config.PRIVACY_POLICY_URL).catch(noop)
    }

    return (
        <FFScrollSheet ref={sheetRef} enablePanDownToClose={false} index={0} snapPoints={[600]}>
            <FFSafeAreaView justifyContent="space-between" flex={1} edges={['bottom']}>
                <FFView>
                    <FFText variant="header1">{t('title')}</FFText>
                    <FFText mt="xs">{t('subtitle')}</FFText>
                    <FFText fontWeight="bold" mt="xs">
                        {t('bullet1.title')}
                    </FFText>
                    <FFText mt="xxs">{t('bullet1.text1')}</FFText>
                    <FFText mt="xxs">{t('bullet1.text2')}</FFText>
                    <FFText mt="xs" fontWeight="bold">
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
                <FFButton variant="primary" onPress={onDismiss} marginTop="s">
                    <FFText variant="labelLarge" fontWeight="bold">
                        {t('confirm')}
                    </FFText>
                </FFButton>
            </FFSafeAreaView>
        </FFScrollSheet>
    )
}
