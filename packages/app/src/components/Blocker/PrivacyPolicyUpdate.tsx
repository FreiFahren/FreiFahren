import { Feather } from '@expo/vector-icons'
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
        <FFScrollSheet ref={ref} enablePanDownToClose={false} index={0} snapPoints={[600]}>
            <Box justifyContent="space-between" flex={1} safeAreaBottom>
                <View>
                    <Text fontSize="xl" color="white" bold>
                        {t('title')}
                    </Text>
                    <Text color="white" mt="4">
                        {t('text')}
                    </Text>
                    <Text color="white" bold mt="4">
                        {t('confirmText')}
                    </Text>
                    <View flexDir="row" alignItems="center" mt={4}>
                        <Feather name="arrow-right" size={16} color="white" />
                        <Text
                            color="white"
                            style={{ textDecorationLine: 'underline' }}
                            onPress={openPrivacyPolicy}
                            ml={2}
                        >
                            {t('link')}
                        </Text>
                    </View>
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
