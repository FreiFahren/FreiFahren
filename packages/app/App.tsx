import 'intl-pluralrules'

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { QueryClientProvider } from '@tanstack/react-query'
// eslint-disable-next-line import/no-namespace
import * as NavigationBar from 'expo-navigation-bar'
import { StatusBar } from 'expo-status-bar'
import { noop } from 'lodash'
import { NativeBaseProvider, View } from 'native-base'
import { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'
import { StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { queryClient } from './src/api'
import i18n from './src/i18n'
import { Main } from './src/Main'
import { theme } from './src/theme'

const App = () => {
    useEffect(() => {
        Promise.all([
            NavigationBar.setBackgroundColorAsync('#00000000'),
            NavigationBar.setPositionAsync('absolute'),
            NavigationBar.setBackgroundColorAsync('#ffffff00'),
        ]).catch(noop)
    }, [])

    return (
        <I18nextProvider i18n={i18n}>
            <SafeAreaProvider>
                <NativeBaseProvider theme={theme}>
                    <QueryClientProvider client={queryClient}>
                        {/* eslint-disable-next-line react/style-prop-object */}
                        <StatusBar style="light" backgroundColor="transparent" />
                        <GestureHandlerRootView style={StyleSheet.absoluteFill}>
                            <BottomSheetModalProvider>
                                <View flex={1} bg="red">
                                    <Main />
                                </View>
                            </BottomSheetModalProvider>
                        </GestureHandlerRootView>
                    </QueryClientProvider>
                </NativeBaseProvider>
            </SafeAreaProvider>
        </I18nextProvider>
    )
}

// eslint-disable-next-line import/no-default-export
export default App
