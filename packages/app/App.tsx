/* eslint-disable global-require */
import 'intl-pluralrules'
import './src/sentry'

import { wrap as sentryWrap } from '@sentry/react-native'
import { ThemeProvider } from '@shopify/restyle'
import { QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
// eslint-disable-next-line import/no-namespace
import * as NavigationBar from 'expo-navigation-bar'
import { hideAsync, preventAutoHideAsync } from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { noop } from 'lodash'
import { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'
import { StyleSheet } from 'react-native'
import { SheetProvider } from 'react-native-actions-sheet'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { queryClient } from './src/api'
import { FFView } from './src/components/common/base'
import i18n from './src/i18n'
import { Main } from './src/Main'
import { theme } from './src/theme'

const useLoadFonts = () => {
    const [loaded, error] = useFonts({
        'Funnel Sans Bold': require('./assets/fonts/Funnel Sans Bold.ttf'),
        'Funnel Sans ExtraBold': require('./assets/fonts/Funnel Sans ExtraBold.ttf'),
        'Funnel Sans Medium': require('./assets/fonts/Funnel Sans Medium.ttf'),
        'Funnel Sans Regular': require('./assets/fonts/Funnel Sans Regular.ttf'),
        'Funnel Sans SemiBold': require('./assets/fonts/Funnel Sans SemiBold.ttf'),
        'Funnel Sans Light': require('./assets/fonts/Funnel Sans Light.ttf'),
        'Funnel Sans Bold Italic': require('./assets/fonts/Funnel Sans Bold Italic.ttf'),
        'Funnel Sans ExtraBold Italic': require('./assets/fonts/Funnel Sans ExtraBold Italic.ttf'),
        'Funnel Sans Italic': require('./assets/fonts/Funnel Sans Italic.ttf'),
        'Funnel Sans Light Italic': require('./assets/fonts/Funnel Sans Light Italic.ttf'),
        'Funnel Sans Medium Italic': require('./assets/fonts/Funnel Sans Medium Italic.ttf'),
        'Funnel Sans SemiBold Italic': require('./assets/fonts/Funnel Sans SemiBold Italic.ttf'),
    })

    useEffect(() => {
        if (loaded || error) {
            hideAsync().catch(noop)
        }
    }, [loaded, error])

    return loaded || error !== null
}

preventAutoHideAsync().catch(noop)

const App = () => {
    useEffect(() => {
        Promise.all([
            NavigationBar.setPositionAsync('absolute'),
            NavigationBar.setBackgroundColorAsync('#ffffff00'),
        ]).catch(noop)
    }, [])

    const fontsDone = useLoadFonts()

    if (!fontsDone) {
        return null
    }

    return (
        <I18nextProvider i18n={i18n}>
            <SafeAreaProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <ThemeProvider theme={theme}>
                        <QueryClientProvider client={queryClient}>
                            {/* eslint-disable-next-line react/style-prop-object */}
                            <StatusBar style="light" backgroundColor="transparent" />
                            <GestureHandlerRootView style={StyleSheet.absoluteFill}>
                                <SheetProvider>
                                    <FFView flex={1} bg="bg">
                                        <Main />
                                    </FFView>
                                </SheetProvider>
                            </GestureHandlerRootView>
                        </QueryClientProvider>
                    </ThemeProvider>
                </GestureHandlerRootView>
            </SafeAreaProvider>
        </I18nextProvider>
    )
}

// eslint-disable-next-line import/no-default-export
export default sentryWrap(App)
