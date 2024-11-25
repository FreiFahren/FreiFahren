import { useTheme } from '@shopify/restyle'
import { forwardRef, PropsWithChildren, Ref, useMemo } from 'react'
import ActionSheet, { ActionSheetProps, ActionSheetRef, ScrollView } from 'react-native-actions-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Theme } from '../../theme'
import { FFView } from './base'

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

export const FFSheetBase = forwardRef(
    ({ children, ...props }: PropsWithChildren<Partial<ActionSheetProps>>, ref: Ref<ActionSheetRef>) => {
        const sheetStyles = useSheetStyles()
        const safeAreaTop = useSafeAreaInsets().top + 20

        return (
            <ActionSheet
                ref={ref}
                containerStyle={sheetStyles.container}
                indicatorStyle={sheetStyles.handle}
                gestureEnabled={true}
                drawUnderStatusBar={false}
                snapPoints={[90]}
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
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
            <FFView px="sm" py="xs" flex={1}>
                {children}
            </FFView>
        </ScrollView>
    </FFSheetBase>
))
