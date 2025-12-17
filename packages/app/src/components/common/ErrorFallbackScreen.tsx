import { noop } from 'lodash'
import { useTranslation } from 'react-i18next'
import { Linking, Platform } from 'react-native'
import RNRestart from 'react-native-restart'

import { config } from '../../config'
import { useTracking } from '../../tracking/provider'
import { FFButton, FFSafeAreaView, FFText, FFView } from './base'

export const ErrorFallbackScreen = ({ error }: { error?: Error | null }) => {
    const { t } = useTranslation('errorFallback')
    const { track } = useTracking()

    const onOpenStore = () => {
        track({ name: 'App Store Opened' })
        const storeUrl = Platform.OS === 'ios' ? config.APP_STORE_URL : config.PLAY_STORE_URL

        Linking.openURL(storeUrl).catch(noop)
    }

    const onRetry = () => {
        track({ name: 'Error Retry Attempted' })
        RNRestart.restart()
    }

    return (
        <FFView width="100%" height="100%" backgroundColor="bg">
            <FFSafeAreaView
                justifyContent="space-between"
                alignItems="center"
                paddingHorizontal="m"
                paddingTop="xl"
                paddingBottom="m"
                flex={1}
            >
                <FFView flex={1}>
                    <FFText variant="header1">{t('title')}</FFText>
                    <FFText mt="m">{t('messageRestart')}</FFText>
                    <FFText mt="m">{t('messageUpdate')}</FFText>

                    {process.env.NODE_ENV === 'development' && error instanceof Error && (
                        <FFView mt="l" padding="m" backgroundColor="bg2" borderRadius="m" width="100%">
                            <FFText variant="labelSmall" fontWeight="bold">
                                {t('developmentErrorDetails')}
                            </FFText>
                            <FFText mt="xs" selectable>
                                {error.toString()}
                            </FFText>
                        </FFView>
                    )}
                </FFView>
                <FFButton variant="secondary" onPress={onRetry} marginTop="m" alignSelf="stretch">
                    <FFText variant="labelLarge" fontWeight="bold">
                        {t('retryButton')}
                    </FFText>
                </FFButton>
                <FFButton variant="primary" onPress={onOpenStore} marginTop="s" alignSelf="stretch">
                    <FFText variant="labelLarge" fontWeight="bold">
                        {t('openStoreButton')}
                    </FFText>
                </FFButton>
            </FFSafeAreaView>
        </FFView>
    )
}
