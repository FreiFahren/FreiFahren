import {
    backgroundColor,
    BackgroundColorProps,
    BackgroundColorShorthandProps,
    border,
    BorderProps,
    color,
    ColorProps,
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
    typography,
    TypographyProps,
    VariantProps,
    visible,
    VisibleProps,
} from '@shopify/restyle'
import { isNil } from 'lodash'
import { ComponentProps } from 'react'
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleProp,
    Text,
    TextInput,
    TextStyle,
    View,
    ViewStyle,
} from 'react-native'
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
    VisibleProps<Theme> &
    ColorProps<Theme> &
    TypographyProps<Theme>

export const FFView = createBox<Theme, ComponentProps<typeof View>>(View)

type PressableProps = BaseProps & ComponentProps<typeof Pressable>

export const FFPressable = createRestyleComponent<PressableProps, Theme>(
    [spacing, backgroundColor, layout, border, position, opacity, shadow, visible],
    Pressable
)

export const FFText = createText<Theme, ComponentProps<typeof Text>>(Text)

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

export const FFButton = ({
    onPress,
    onPressIn,
    onPressOut,
    onLongPress,
    disabled = false,
    loading = false,
    label,
    icon,
    iconPosition = 'left',
    children,
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
                    <FFText variant="label" opacity={disabled === true ? 0.6 : 1}>
                        {label}
                    </FFText>
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
            flexDirection="row"
            style={pressableStyle}
            activeOpacity={activeOpacity}
            {...rest}
        >
            {renderContent()}
        </ButtonContainer>
    )
}

// Add FFTextInput component
type TextInputProps = ComponentProps<typeof TextInput>

// Fix the type definition to correctly reference textInputVariants
type RestyleTextInputProps = SpacingProps<Theme> &
    LayoutProps<Theme> &
    BorderProps<Theme> &
    BackgroundColorProps<Theme> &
    ColorProps<Theme> &
    TypographyProps<Theme> &
    VariantProps<Theme, 'textInputVariants'> & {
        placeholderTextColor?: string
    }

export const FFTextInput = createRestyleComponent<RestyleTextInputProps & TextInputProps, Theme>(
    [spacing, layout, border, backgroundColor, color, typography, createVariant({ themeKey: 'textInputVariants' })],
    TextInput
)
