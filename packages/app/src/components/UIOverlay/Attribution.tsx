import { noop } from 'lodash'
import { ComponentProps } from 'react'
import { Dimensions, Linking, Pressable } from 'react-native'

import { FFText, FFView } from '../common/base'

export const Attribution = (props: ComponentProps<typeof FFView>) => {
    const links = [
        {
            text: 'MapLibre',
            url: 'https://maplibre.org',
        },
        {
            text: '©Jawg',
            url: 'https://jawg.io',
        },
        {
            text: '©OpenStreetMap',
            url: 'https://openstreetmap.org',
        },
    ]

    const { width } = Dimensions.get('screen')

    return (
        <FFView
            gap="xxxs"
            flexDirection="row"
            style={{
                transform: [{ rotate: '90deg' }],
                justifyContent: 'center',
                width: '100%',
                position: 'absolute',
                left: -width / 2 + 8,
                top: '50%',
                transformOrigin: 'center',
                opacity: 0.5,
            }}
            {...props}
        >
            {links.map((link) => (
                <Pressable
                    onPress={() => {
                        Linking.openURL(link.url).catch(noop)
                    }}
                    key={link.url}
                >
                    <FFText variant="tiny">{link.text}</FFText>
                </Pressable>
            ))}
        </FFView>
    )
}
