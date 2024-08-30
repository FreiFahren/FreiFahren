import React, { useState } from 'react'
import './SelectField.css'

interface SelectFieldProps {
    children: React.ReactNode
    containerClassName?: string
    fieldClassName?: string
    onSelect?: (selectedValue: string) => void
}

const SelectField: React.FC<SelectFieldProps> = ({ children, containerClassName, fieldClassName, onSelect }) => {
    const [selected, setSelected] = useState<React.ReactNode>(null)

    const handleSelect = (child: React.ReactNode) => {
        setSelected(child)
        if (onSelect && React.isValidElement(child)) {
            const selectedValue = child.props.children.props.children
            onSelect(selectedValue)
        }
    }

    return (
        <div className={`select-field-container ${containerClassName}`}>
            {React.Children.map(children, (child, index) => (
                <div
                    key={index}
                    className={`select-field ${selected === child ? 'selected' : ''} ${fieldClassName}`}
                    onClick={() => handleSelect(child)}
                >
                    {child}
                </div>
            ))}
        </div>
    )
}

export default SelectField
