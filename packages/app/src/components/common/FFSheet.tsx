import { BottomSheetModal, BottomSheetModalProps, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { useTheme } from '@shopify/restyle'
import { forwardRef, PropsWithChildren, Ref } from 'react'
import { View as RNView, ViewProps } from 'react-native'

import { Theme } from '../../theme'
import { FFView } from './base'

export const SheetHandle = () => (
    <FFView
        backgroundColor="darkGrey"
        height={4}
        width={50}
        borderRadius="full"
        alignSelf="center"
        position="absolute"
        top={10}
    />
)

const SheetBackground = ({ style, ...props }: ViewProps) => {
    const theme = useTheme<Theme>()

    return (
        <RNView
            style={[
                style,
                {
                    backgroundColor: theme.colors.bg,
                    borderColor: theme.colors.bg2,
                    borderWidth: 2,
                    flex: 1,
                    borderTopLeftRadius: 25,
                    borderTopRightRadius: 25,
                },
            ]}
            {...props}
        />
    )
}

const FFSheetBase = forwardRef(
    ({ children, ...props }: PropsWithChildren<Partial<BottomSheetModalProps>>, ref: Ref<BottomSheetModalMethods>) => (
        <BottomSheetModal
            ref={ref}
            snapPoints={['35%', '80%']}
            index={0}
            handleComponent={SheetHandle}
            backgroundComponent={SheetBackground}
            {...props}
        >
            <FFView flex={1}>{children}</FFView>
        </BottomSheetModal>
    )
)

export const FFSheet = forwardRef(
    ({ children, ...props }: PropsWithChildren<Partial<BottomSheetModalProps>>, ref: Ref<BottomSheetModalMethods>) => (
        <FFSheetBase ref={ref} {...props}>
            <FFView px="sm" py="sm">
                {children}
            </FFView>
        </FFSheetBase>
    )
)
export const FFScrollSheet = forwardRef(
    ({ children, ...props }: PropsWithChildren<Partial<BottomSheetModalProps>>, ref: Ref<BottomSheetModalMethods>) => (
        <FFSheetBase ref={ref} {...props}>
            <BottomSheetScrollView contentContainerStyle={{ flexGrow: 1 }}>
                <FFView px="sm" py="sm" flex={1}>
                    {children}
                </FFView>
            </BottomSheetScrollView>
        </FFSheetBase>
    )
)
