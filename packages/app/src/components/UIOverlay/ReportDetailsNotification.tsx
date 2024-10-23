import { MaterialIcons } from '@expo/vector-icons'
import { ComponentProps, useEffect } from 'react'
import { Pressable } from 'react-native'
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { Report } from '../../api'
import { FFBox } from '../common/FFBox'
import { ReportItem } from '../common/ReportItem'

const animationConfig = {
    duration: 300,
    easing: Easing.elastic(0.3),
}

type ReportDetailsNotificationProps = {
    report: Report
    onClose: () => void
} & ComponentProps<typeof FFBox>

export const ReportDetailsNotification = ({ report, onClose, ...props }: ReportDetailsNotificationProps) => {
    const animation = useSharedValue(1)

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: animation.value * 200 }],
    }))

    useEffect(() => {
        animation.value = withTiming(0, animationConfig)
    }, [animation])

    const handleClose = () => {
        animation.value = withTiming(1, animationConfig, () => runOnJS(onClose)())
    }

    return (
        <Animated.View style={animatedStyle}>
            <FFBox flexDir="row" alignItems="center" justifyContent="space-between" px={4} {...props}>
                <ReportItem report={report} />
                <Pressable onPress={handleClose} hitSlop={10}>
                    <MaterialIcons name="close" color="white" size={32} />
                </Pressable>
            </FFBox>
        </Animated.View>
    )
}
