import './SelectField.css'

import { Children, isValidElement, ReactNode, useCallback } from 'react'

interface SelectFieldProps {
    children: React.ReactNode
    containerClassName?: string
    fieldClassName?: string
    onSelect: (selectedValue: string | null) => void
    value: string | null
}
/**
 * SelectField component allows for the selection of a single value from a list of options.
 * It is used in the ReportForm component to select entities, lines, stations, and directions.
 *
 * @param {React.ReactNode} children - The child elements to be rendered as selectable options.
 * @param {string} [containerClassName] - Optional class name for the container div.
 * @param {string} [fieldClassName] - Optional class name for each selectable field.
 * @param {function} onSelect - Callback function to handle the selection of an option.
 * @param {string | null} value - The currently selected value.
 */
export const SelectField = ({ children, containerClassName, fieldClassName, onSelect, value }: SelectFieldProps) => {
    const handleSelect = useCallback(
        (child: ReactNode) => {
            if (isValidElement(child)) {
                const selectedValue = child.props.children.props.children
                const newValue = value === selectedValue ? null : selectedValue // Toggle selection

                onSelect(newValue)
            }
        },
        [onSelect, value]
    )

    return (
        <div className={`select-field-container ${containerClassName}`}>
            {Children.map(
                children,
                (child, index) =>
                    isValidElement(child) && (
                        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                        <div
                            // eslint-disable-next-line react/no-array-index-key
                            key={index}
                            className={`select-field ${value === child.props.children.props.children ? 'selected' : ''} ${fieldClassName}`}
                            onClick={() => handleSelect(child)}
                        >
                            {child}
                        </div>
                    )
            )}
        </div>
    )
}
