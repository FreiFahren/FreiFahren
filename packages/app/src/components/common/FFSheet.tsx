import { AntDesign } from '@expo/vector-icons'
import { useTheme } from '@shopify/restyle'
import { ComponentProps, forwardRef, PropsWithChildren, ReactNode, Ref, useMemo } from 'react'
import { Platform, Pressable } from 'react-native'
import ActionSheet, { ActionSheetProps, ActionSheetRef, ScrollView } from 'react-native-actions-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Theme } from '../../theme'
import { FFText, FFView } from './base'

const useSheetStyles = () => {
    const theme = useTheme<Theme>()

    return useMemo(
        () => ({
            container: {
                backgroundColor: theme.colors.bg,
                borderTopLeftRadius: theme.borderRadii.m,
                borderTopRightRadius: theme.borderRadii.m,
                borderWidth: 2,
                borderBottomWidth: 0,
                borderColor: theme.colors.border,
                padding: 0,
            },
            handle: {
                backgroundColor: theme.colors.darkGrey,
                height: 4,
                width: 50,
            },
        }),
        [theme]
    )
}

type FFSheetHeaderProps = {
    title: string | ReactNode
    onClose?: () => void
} & ComponentProps<typeof FFView>

export const FFSheetHeader = forwardRef(
    ({ title, onClose, ...props }: FFSheetHeaderProps, ref: Ref<ActionSheetRef>) => {
        const theme = useTheme<Theme>()

        return (
            <FFView flexDirection="row" justifyContent="space-between" alignItems="center" {...props}>
                {typeof title === 'string' ? (
                    <FFText variant="header1" color="fg">
                        {title}
                    </FFText>
                ) : (
                    title
                )}
                {Platform.OS === 'android' && (
                    <Pressable
                        onPress={() => {
                            if (ref instanceof Function) return
                            ref?.current?.hide()
                            onClose?.()
                        }}
                    >
                        <AntDesign name="close" size={28} color={theme.colors.fg} />
                    </Pressable>
                )}
            </FFView>
        )
    }
)

export const FFSheetBase = forwardRef(
    ({ children, ...props }: PropsWithChildren<Partial<ActionSheetProps>>, ref: Ref<ActionSheetRef>) => {
        const sheetStyles = useSheetStyles()
        const safeAreaTop = useSafeAreaInsets().top + 20

        return (
            <ActionSheet
                ref={ref}
                containerStyle={sheetStyles.container}
                indicatorStyle={sheetStyles.handle}
                gestureEnabled={Platform.OS === 'ios'}
                drawUnderStatusBar={false}
                snapPoints={[100]}
                openAnimationConfig={{
                    damping: 20,
                    mass: 0.8,
                    stiffness: 180,
                    overshootClamping: false,
                    restSpeedThreshold: 0.001,
                    restDisplacementThreshold: 0.001,
                }}
                safeAreaInsets={{
                    bottom: 0,
                    left: 0,
                    right: 0,
                    top: safeAreaTop,
                }}
                {...props}
            >
                {children}
            </ActionSheet>
        )
    }
)

export const FFSheet = forwardRef(
    ({ children, ...props }: PropsWithChildren<Partial<ActionSheetProps>>, ref: Ref<ActionSheetRef>) => (
        <FFSheetBase ref={ref} {...props}>
            <FFView px="sm" py="xs">
                {children}
            </FFView>
        </FFSheetBase>
    )
)

export const FFScrollSheet = forwardRef(({ children, ...props }: ActionSheetProps, ref: Ref<ActionSheetRef>) => (
    <FFSheetBase ref={ref} {...props}>
        <ScrollView>
            <FFView px="sm" py="xs">
                {children}
            </FFView>
        </ScrollView>
    </FFSheetBase>
))
