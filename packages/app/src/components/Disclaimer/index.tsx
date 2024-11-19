import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { noop, pick } from 'lodash'
import { DateTime, Duration } from 'luxon'
import { Box, Text } from 'native-base'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, View } from 'react-native'

import { useAppStore } from '../../app.store'
import { config } from '../../config'
import { track } from '../../tracking'
import { FFButton } from '../common/FFButton'
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
        track({ name: 'disclaimer-viewed' })
    }, [dismissedDisclaimerAt, update])

    if (disclaimerGood) {
        return null
    }

    const onDismiss = () => {
        track({ name: 'disclaimer-dismissed' })
        update({ dismissedDisclaimerAt: DateTime.now().toISO() })
        sheetRef.current?.dismiss()
    }

    const openPrivacyPolicy = () => {
        track({ name: 'privacy-policy-viewed', from: 'disclaimer' })
        Linking.openURL(config.PRIVACY_POLICY_URL).catch(noop)
    }

    return (
        <FFScrollSheet ref={sheetRef} enablePanDownToClose={false} index={0} snapPoints={[600]}>
            <Box justifyContent="space-between" flex={1} safeAreaBottom>
                <View>
                    <Text fontSize="xl" color="white" bold>
                        {t('title')}
                    </Text>
                    <Text color="white" mt="4">
                        {t('subtitle')}
                    </Text>
                    <Text color="white" bold mt="4">
                        {t('bullet1.title')}
                    </Text>
                    <Text color="white" mt="2">
                        {t('bullet1.text1')}
                    </Text>
                    <Text color="white" mt="2">
                        {t('bullet1.text2')}
                    </Text>
                    <Text color="white" mt="4" bold>
                        {t('bullet2.title')}
                    </Text>
                    <Text color="white" mt="2">
                        {t('bullet2.text')}
                        <Text style={{ textDecorationLine: 'underline' }} onPress={openPrivacyPolicy}>
                            {t('bullet2.privacyPolicy')}
                        </Text>
                    </Text>
                    <Text color="white" mt="4">
                        {t('endText')}
                    </Text>
                </View>
                <FFButton onPress={onDismiss} bg="blue" borderColor="blue" mt={8}>
                    <Text fontSize="xl" bold>
                        {t('confirm')}
                    </Text>
                </FFButton>
            </Box>
        </FFScrollSheet>
    )
}
