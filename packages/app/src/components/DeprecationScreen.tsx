import { noop } from 'lodash'
import { useTranslation } from 'react-i18next'
import { Linking, Platform } from 'react-native'

import { config } from '../config'
import { track } from '../tracking'
import { FFButton, FFSafeAreaView, FFText, FFView } from './common/base'

export const DeprecationScreen = () => {
    const { t } = useTranslation('deprecation')

    const platform = Platform.OS

    const onOpenStore = () => {
        track({ name: 'App Store Opened' })
        Linking.openURL(platform === 'ios' ? config.APP_STORE_URL : config.PLAY_STORE_URL).catch(noop)
    }

    return (
        <FFView width="100%" height="100%">
            <FFSafeAreaView justifyContent="space-between" padding="sm" flex={1}>
                <FFView>
                    <FFText variant="header1">{t('title')}</FFText>
                    <FFText mt="xs">{t('text')}</FFText>
                </FFView>
                <FFButton variant="primary" onPress={onOpenStore}>
                    <FFText variant="labelLarge" fontWeight="bold">
                        {t('openStore')}
                    </FFText>
                </FFButton>
            </FFSafeAreaView>
        </FFView>
    )
}
