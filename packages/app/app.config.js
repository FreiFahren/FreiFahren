/* eslint-disable import/no-default-export */
export default {
    expo: {
        name: 'freifahren',
        slug: 'Freifahren',
        version: '0.0.9',
        orientation: 'portrait',
        icon: './assets/app-icon.png',
        userInterfaceStyle: 'dark',
        plugins: [
            'expo-localization',
            [
                'expo-dev-launcher',
                {
                    launchMode: 'most-recent',
                },
            ],
            '@maplibre/maplibre-react-native',
            [
                'expo-build-properties',
                {
                    android: {
                        lint: {
                            checkReleaseBuilds: false,
                        },
                    },
                },
            ],
            [
                '@sentry/react-native/expo',
                {
                    url: 'https://sentry.io/',
                },
            ],
            [
                'expo-font',
                {
                    fonts: [
                        './assets/fonts/Funnel Sans Bold.ttf',
                        './assets/fonts/Funnel Sans ExtraBold.ttf',
                        './assets/fonts/Funnel Sans Medium.ttf',
                        './assets/fonts/Funnel Sans Regular.ttf',
                        './assets/fonts/Funnel Sans SemiBold.ttf',
                        './assets/fonts/Funnel Sans Light.ttf',
                        './assets/fonts/Funnel Sans Bold Italic.ttf',
                        './assets/fonts/Funnel Sans Italic.ttf',
                        './assets/fonts/Funnel Sans Light Italic.ttf',
                        './assets/fonts/Funnel Sans Medium Italic.ttf',
                        './assets/fonts/Funnel Sans SemiBold Italic.ttf',
                        './assets/fonts/Funnel Sans ExtraBold Italic.ttf',
                    ],
                },
            ],
        ],
        splash: {
            resizeMode: 'contain',
            image: './assets/app-icon.png',
            backgroundColor: '#2b2b2b',
        },
        assetBundlePatterns: ['**/*'],
        ios: {
            supportsTablet: false,
            bundleIdentifier: 'com.anonymous.Freifahren',
            usesNonExemptEncryption: false,
            infoPlist: {
                NSLocationWhenInUseUsageDescription:
                    'This app uses your location to show your current position on the map. It is never sent anywhere, stored, or shared with others.',
                NSLocationAlwaysAndWhenInUseUsageDescription:
                    'This app uses your location to show your current position on the map. It is never sent anywhere, stored, or shared with others.',
            },
        },
        android: {
            adaptiveIcon: {
                foregroundImage: './assets/app-icon-adaptive.png',
                backgroundColor: '#2b2b2b',
            },
            package: 'com.anonymous.Freifahren',
            permissions: ['ACCESS_FINE_LOCATION', 'INTERNET'],
        },
        web: {
            favicon: './assets/favicon.png',
        },
    },
}
