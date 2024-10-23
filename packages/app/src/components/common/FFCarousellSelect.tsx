import { FontAwesome5 } from '@expo/vector-icons'
import { Pressable, Row, Stack, Text, useTheme, View } from 'native-base'
import { ComponentProps, PropsWithChildren, ReactNode, useEffect, useState } from 'react'
import { LayoutAnimation } from 'react-native'

import { Theme } from '../../theme'

type OptionContainerProps = {
    isSelected: boolean
    onSelect: () => void
} & Omit<ComponentProps<typeof Pressable>, 'onPress'>

const OptionContainer = ({ isSelected, onSelect, children, ...props }: PropsWithChildren<OptionContainerProps>) => {
    const theme = useTheme() as Theme

    return (
        <Pressable
            borderRadius={8}
            borderWidth={2}
            opacity={isSelected ? 1 : 0.5}
            borderColor={isSelected ? theme.colors.selected : theme.colors.bg2}
            alignItems="center"
            justifyContent="center"
            position="relative"
            onPress={onSelect}
            {...props}
        >
            {children}
            {isSelected && (
                <View bg="selected" borderRadius="full" position="absolute" bottom={2} right={2} p={1}>
                    <FontAwesome5 name="check" size={14} color="white" />
                </View>
            )}
        </Pressable>
    )
}

const collapseExpandAnimationConfig = {
    ...LayoutAnimation.Presets.easeInEaseOut,
    duration: 400,
}

type FFCarousellSelectProps<T> = {
    options: T[]
    renderOption: (option: T, isSelected: boolean) => ReactNode
    onSelect: (option: T) => void
    selectedOption: T | null
    containerProps?: ComponentProps<typeof Pressable>
    vertical?: boolean
    collapses?: boolean
}

export const FFCarousellSelect = <T,>({
    options,
    renderOption,
    onSelect,
    selectedOption,
    containerProps,
    vertical = false,
    collapses = false,
}: FFCarousellSelectProps<T>) => {
    const Container = vertical ? Stack : Row

    const [isCollapsed, setIsCollapsed] = useState(false)

    const [localSelectedOption, setLocalSelectedOption] = useState(selectedOption)

    useEffect(() => {
        setLocalSelectedOption(selectedOption)
        if (selectedOption === null) {
            setIsCollapsed(false)
        }
    }, [selectedOption])

    const handleSelectOption = (option: T) => {
        setLocalSelectedOption(option)
        if (collapses) {
            LayoutAnimation.configureNext(collapseExpandAnimationConfig)
            setIsCollapsed(collapses)
        }
        onSelect(option)
    }

    const handleExpand = () => {
        LayoutAnimation.configureNext(collapseExpandAnimationConfig)
        setIsCollapsed(false)
    }

    return isCollapsed ? (
        <OptionContainer isSelected={localSelectedOption !== null} onSelect={handleExpand} {...containerProps}>
            {localSelectedOption === null ? (
                <Text color="fg">Nicht ausgewählt</Text>
            ) : (
                renderOption(localSelectedOption, true)
            )}
        </OptionContainer>
    ) : (
        <Container space={2}>
            {options.map((option, index) => (
                <OptionContainer
                    // eslint-disable-next-line react/no-array-index-key
                    key={index}
                    isSelected={localSelectedOption === option}
                    onSelect={() => handleSelectOption(option)}
                    {...containerProps}
                >
                    {renderOption(option, localSelectedOption === option)}
                </OptionContainer>
            ))}
        </Container>
    )
}
