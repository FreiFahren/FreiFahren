/* eslint-disable import/no-default-export */

export default {
    expo: {
        name: 'freifahren',
        slug: 'Freifahren',
        version: '0.0.1',
        orientation: 'portrait',
        icon: './assets/app-icon.png',
        userInterfaceStyle: 'dark',
        plugins: [
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
        ],
        splash: {
            resizeMode: 'contain',
            image: './assets/app-icon.png',
            backgroundColor: '#2b2b2b',
        },
        assetBundlePatterns: ['**/*'],
        ios: {
            buildNumber: process.env.VERSION_CODE,
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
            versionCode: parseInt(process.env.VERSION_CODE ?? '1', 10),
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
        extra: {
            eas: {
                projectId: '25e04c03-8adb-462b-a6a5-83690823b47d',
            },
        },
    },
}
