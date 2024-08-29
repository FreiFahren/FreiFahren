import React, { useState } from 'react'
import './SelectField.css'

interface SelectFieldProps {
    children: React.ReactNode
    containerClassName?: string
    fieldClassName?: string
}

const SelectField: React.FC<SelectFieldProps> = ({ children, containerClassName, fieldClassName }) => {
    const [selected, setSelected] = useState<React.ReactNode>(null)

    return (
        <div className={`select-field-container ${containerClassName}`}>
            {React.Children.map(children, (child, index) => (
                <div
                    key={index}
                    className={`select-field ${selected === child ? 'selected' : ''} ${fieldClassName}`}
                    onClick={() => setSelected(child)}
                >
                    {child}
                </div>
            ))}
        </div>
    )
}

export default SelectField
