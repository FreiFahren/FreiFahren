import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { pick } from 'lodash'
import { DateTime, Duration } from 'luxon'
import { Box, Text } from 'native-base'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { useAppStore } from '../../app.store'
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
            }
        }
    }, [dismissedDisclaimerAt, update])

    if (disclaimerGood) {
        return null
    }

    const onDismiss = () => {
        update({ dismissedDisclaimerAt: DateTime.now().toISO() })
        sheetRef.current?.dismiss()
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
                        {t('bullet1.text')}
                    </Text>
                    <Text color="white" mt="4" bold>
                        {t('bullet2.title')}
                    </Text>
                    <Text color="white" mt="2">
                        {t('bullet2.text')}
                    </Text>
                </View>
                <FFButton onPress={onDismiss} bg="blue" borderColor="blue" mt={4}>
                    <Text fontSize="xl" bold>
                        {t('confirm')}
                    </Text>
                </FFButton>
            </Box>
        </FFScrollSheet>
    )
}
