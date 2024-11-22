import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { noop } from 'lodash'
import { Box, Text, View } from 'native-base'
import { forwardRef, Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking } from 'react-native'

import { config } from '../../config'
import { track } from '../../tracking'
import { FFButton } from '../common/FFButton'
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
        <FFScrollSheet ref={ref} enablePanDownToClose={false} index={0} snapPoints={[600]}>
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
})
