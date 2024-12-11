import React, { useCallback } from 'react'
import './SelectField.css'

interface SelectFieldProps {
    children: React.ReactNode
    containerClassName?: string
    fieldClassName?: string
    onSelect: (selectedValue: string | null) => void
    value: string | null
    getValue: (child: React.ReactElement) => string
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
 * @param {function} getValue - Function to extract the value from a child component.
 */
const SelectField: React.FC<SelectFieldProps> = ({
    children,
    containerClassName,
    fieldClassName,
    onSelect,
    value,
    getValue,
}) => {
    const handleSelect = useCallback(
        (child: React.ReactNode) => {
            if (React.isValidElement(child)) {
                const selectedValue = getValue(child)
                const newValue = value === selectedValue ? null : selectedValue // Toggle selection
                onSelect(newValue)
            }
        },
        [onSelect, value, getValue]
    )

    return (
        <div className={`select-field-container ${containerClassName}`}>
            {React.Children.map(
                children,
                (child, index) =>
                    React.isValidElement(child) && (
                        <div
                            key={index}
                            className={`select-field ${value === getValue(child) ? 'selected' : ''} ${fieldClassName}`}
                            onClick={() => handleSelect(child)}
                        >
                            {child}
                        </div>
                    )
            )}
        </div>
    )
}

export default SelectField
