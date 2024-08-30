import React, { useState, useCallback } from 'react'
import './SelectField.css'

interface SelectFieldProps {
    children: React.ReactNode
    containerClassName?: string
    fieldClassName?: string
    onSelect: (selectedValue: string) => void
}

const SelectField: React.FC<SelectFieldProps> = ({ children, containerClassName, fieldClassName, onSelect }) => {
    const [selected, setSelected] = useState<string | null>(null)

    const handleSelect = useCallback(
        (child: React.ReactNode) => {
            if (React.isValidElement(child)) {
                const selectedValue = child.props.children.props.children
                setSelected(selectedValue)
                console.log('Selected Value:', selectedValue)
                onSelect(selectedValue)
            }
        },
        [onSelect]
    )

    return (
        <div className={`select-field-container ${containerClassName}`}>
            {React.Children.map(
                children,
                (child, index) =>
                    React.isValidElement(child) && (
                        <div
                            key={index}
                            className={`select-field ${selected === child.props.children.props.children ? 'selected' : ''} ${fieldClassName}`}
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
