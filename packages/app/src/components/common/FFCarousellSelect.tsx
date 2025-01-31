import { FontAwesome5 } from '@expo/vector-icons'
import { ComponentProps, PropsWithChildren, ReactNode, useEffect, useState } from 'react'
import { LayoutAnimation } from 'react-native'

import { FFButton, FFPressable, FFText, FFView } from './base'

type OptionContainerProps = {
    isSelected: boolean
    onSelect: () => void
    hideCheck?: boolean
} & Omit<ComponentProps<typeof FFButton>, 'onPress' | 'ref'>

const OptionContainer = ({
    isSelected,
    onSelect,
    children,
    hideCheck = false,
    ...props
}: PropsWithChildren<OptionContainerProps>) => {
    return (
        <FFButton
            borderRadius="m"
            borderWidth={2}
            opacity={isSelected ? 1 : 0.7}
            borderColor={isSelected ? 'selected' : 'border'}
            position="relative"
            onPress={onSelect}
            variant="selector"
            {...props}
        >
            {children}
            {!hideCheck && isSelected && (
                <FFView bg="selected" borderRadius="full" position="absolute" p="xxxs" bottom={8} right={8}>
                    <FontAwesome5 name="check" size={14} color="white" />
                </FFView>
            )}
        </FFButton>
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
    containerProps?: ComponentProps<typeof FFPressable>
    vertical?: boolean
    collapses?: boolean
    hideCheck?: boolean
}

export const FFCarousellSelect = <T,>({
    options,
    renderOption,
    onSelect,
    selectedOption,
    containerProps,
    vertical = false,
    collapses = false,
    hideCheck = false,
}: FFCarousellSelectProps<T>) => {
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
                <FFText variant="small" color="fg">
                    Nicht ausgewählt
                </FFText>
            ) : (
                renderOption(localSelectedOption, true)
            )}
        </OptionContainer>
    ) : (
        <FFView gap="xxs" flexDirection={vertical ? 'column' : 'row'}>
            {options.map((option, index) => (
                <OptionContainer
                    // eslint-disable-next-line react/no-array-index-key
                    key={index}
                    isSelected={localSelectedOption === option}
                    hideCheck={hideCheck}
                    onSelect={() => handleSelectOption(option)}
                    {...containerProps}
                >
                    {renderOption(option, localSelectedOption === option)}
                </OptionContainer>
            ))}
        </FFView>
    )
}
