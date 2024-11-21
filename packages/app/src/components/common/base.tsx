import {
    backgroundColor,
    BackgroundColorProps,
    BackgroundColorShorthandProps,
    border,
    BorderProps,
    createBox,
    createRestyleComponent,
    createText,
    createVariant,
    layout,
    LayoutProps,
    opacity,
    OpacityProps,
    position,
    PositionProps,
    shadow,
    ShadowProps,
    spacing,
    SpacingProps,
    SpacingShorthandProps,
    VariantProps,
    visible,
    VisibleProps,
} from '@shopify/restyle'
import { isNil } from 'lodash'
import { ComponentProps } from 'react'
import { ActivityIndicator, Image, Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Theme } from '../../theme'

type BaseProps = SpacingProps<Theme> &
    SpacingShorthandProps<Theme> &
    BackgroundColorProps<Theme> &
    BackgroundColorShorthandProps<Theme> &
    LayoutProps<Theme> &
    BorderProps<Theme> &
    PositionProps<Theme> &
    OpacityProps<Theme> &
    ShadowProps<Theme> &
    VisibleProps<Theme>

export const FFView = createBox<Theme>()

type PressableProps = BaseProps & ComponentProps<typeof Pressable>

export const FFPressable = createRestyleComponent<PressableProps, Theme>(
    [spacing, backgroundColor, layout, border, position, opacity, shadow, visible],
    Pressable
)

export const FFText = createText<Theme>()

type SafeAreaProps = BaseProps & ComponentProps<typeof SafeAreaView>

export const FFSafeAreaView = createRestyleComponent<SafeAreaProps, Theme>(
    [spacing, backgroundColor, layout, border, position, opacity, shadow, visible],
    SafeAreaView
)

type ImageProps = BaseProps & ComponentProps<typeof Image>

export const FFImage = createRestyleComponent<ImageProps, Theme>(
    [spacing, backgroundColor, layout, border, position, opacity, shadow, visible],
    Image
)

const buttonVariant = createVariant<Theme, 'buttonVariants'>({
    themeKey: 'buttonVariants',
})

type RestyleButtonProps = SpacingProps<Theme> &
    SpacingShorthandProps<Theme> &
    BorderProps<Theme> &
    BackgroundColorProps<Theme> &
    OpacityProps<Theme> &
    LayoutProps<Theme> &
    PositionProps<Theme> &
    VariantProps<Theme, 'buttonVariants'> &
    ComponentProps<typeof Pressable> & {
        loading?: boolean
        label?: string
        labelStyle?: TextStyle
        icon?: React.ReactNode
        iconPosition?: 'left' | 'right'
        activeOpacity?: number
        pressableStyle?: ViewStyle
        style?: StyleProp<ViewStyle>
    }

const ButtonContainer = createRestyleComponent<RestyleButtonProps, Theme>(
    [buttonVariant, layout, position, spacing, border, backgroundColor, opacity],
    Pressable
)

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
    },
    label: {
        color: 'white',
        textAlign: 'center',
        marginHorizontal: 8,
    },
    disabled: {
        opacity: 0.5,
    },
    disabledLabel: {
        opacity: 0.5,
    },
})

export const FFButton = ({
    onPress,
    onPressIn,
    onPressOut,
    onLongPress,
    disabled = false,
    loading = false,
    label,
    labelStyle,
    icon,
    iconPosition = 'left',
    children,
    style,
    activeOpacity = 0.7,
    pressableStyle,
    ...rest
}: RestyleButtonProps) => {
    const renderContent = () => {
        if (loading) {
            return <ActivityIndicator color="white" />
        }

        if (!isNil(children)) {
            return children
        }

        return (
            <>
                {!isNil(icon) && iconPosition === 'left' && icon}
                {!isNil(label) && (
                    <Text style={[styles.label, labelStyle, disabled === true ? styles.disabledLabel : {}]}>
                        {label}
                    </Text>
                )}
                {!isNil(icon) && iconPosition === 'right' && icon}
            </>
        )
    }

    return (
        <ButtonContainer
            disabled={(disabled ?? false) || loading}
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onLongPress={onLongPress}
            style={[styles.container, style ?? {}, disabled === true ? styles.disabled : {}, pressableStyle ?? {}]}
            activeOpacity={activeOpacity}
            {...rest}
        >
            {renderContent()}
        </ButtonContainer>
    )
}
