import { useTheme } from '@shopify/restyle'
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import { Theme } from '../../theme'
import { FFView } from './base'

const styles = StyleSheet.create({
    spinner: {
        width: '100%',
        height: '100%',
        position: 'absolute',
        borderWidth: 5,
        borderRadius: 9999,
    },
})

interface FFSpinnerProps {
    size?: number
    color1?: string
    color2?: string
    speed?: number
}

export const FFSpinner = ({ size = 10, color2, color1, speed = 650 }: FFSpinnerProps) => {
    const theme = useTheme<Theme>()
    const rotation = useSharedValue(0)

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(rotation.value + 360, {
                duration: speed,
                easing: Easing.linear,
            }),
            -1,
            false
        )
    }, [rotation, speed])

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }))

    const color = color1 ?? theme.colors.bg

    return (
        <FFView width={size} height={size}>
            <Animated.View
                style={[
                    styles.spinner,
                    {
                        borderLeftColor: color,
                        borderRightColor: color,
                        borderBottomColor: color,
                        borderTopColor: color2 ?? 'transparent',
                    },
                    animatedStyle,
                ]}
            />
        </FFView>
    )
}
