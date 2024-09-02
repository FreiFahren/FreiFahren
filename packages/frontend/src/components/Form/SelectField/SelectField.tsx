import React, { useCallback } from 'react'
import './SelectField.css'

interface SelectFieldProps {
    children: React.ReactNode
    containerClassName?: string
    fieldClassName?: string
    onSelect: (selectedValue: string | null) => void
    value: string | null
}

const SelectField: React.FC<SelectFieldProps> = ({ children, containerClassName, fieldClassName, onSelect, value }) => {
    const handleSelect = useCallback(
        (child: React.ReactNode) => {
            if (React.isValidElement(child)) {
                const selectedValue = child.props.children.props.children
                const newValue = value === selectedValue ? null : selectedValue // Toggle selection
                onSelect(newValue)
            }
        },
        [onSelect, value]
    )

    return (
        <div className={`select-field-container ${containerClassName}`}>
            {React.Children.map(
                children,
                (child, index) =>
                    React.isValidElement(child) && (
                        <div
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

export default SelectField
