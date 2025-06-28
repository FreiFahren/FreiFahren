import './SelectField.css'

import React, { useCallback } from 'react'

/**
 * Extracts text content from a React element by traversing its children recursively
 * @param element - The React element to extract text from
 * @returns The text content of the leaf nodes within the element
 */
const extractTextContent = (element: React.ReactElement): string => {
    const findLeafText = (node: React.ReactNode): string | null => {
        if (typeof node === 'string' || typeof node === 'number') {
            return String(node).trim()
        }

        if (React.isValidElement(node)) {
            const props = node.props as Record<string, unknown>

            // Check for explicit select value prop (convention-based approach)
            if (props['data-select-value']) {
                return String(props['data-select-value'])
            }

            // For custom components, scan props for likely value candidates
            if (typeof node.type === 'function') {
                // Priority order: value, text, label, name, id, then any single-character string prop
                const candidateProps = ['value', 'text', 'label', 'name', 'id']

                for (const propName of candidateProps) {
                    if (props[propName] && typeof props[propName] === 'string') {
                        return props[propName]
                    }
                }

                // Look for any string prop that might be a single character or short value
                for (const [key, value] of Object.entries(props)) {
                    if (
                        typeof value === 'string' &&
                        value.length <= 3 &&
                        value.length > 0 &&
                        !['className', 'style', 'key', 'ref'].includes(key)
                    ) {
                        return value
                    }
                }
            }

            // Regular DOM elements - traverse children to find first leaf text
            if (props.children) {
                if (Array.isArray(props.children)) {
                    // Find the first non-empty leaf text from children
                    for (const child of props.children) {
                        const leafText = findLeafText(child)
                        if (leafText && leafText.length > 0) {
                            return leafText
                        }
                    }
                } else {
                    return findLeafText(props.children as React.ReactNode)
                }
            }
        }

        return null
    }

    return findLeafText(element) ?? ''
}

interface SelectFieldProps {
    children: React.ReactNode
    containerClassName?: string
    fieldClassName?: string
    onSelect: (selectedValue: string | null) => void
    value: string | null
    getValue?: (child: React.ReactElement) => string
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
 * @param {function} [getValue] - Function to extract the value from a child component. Defaults to extractTextContent.
 */
const SelectField: React.FC<SelectFieldProps> = ({
    children,
    containerClassName,
    fieldClassName,
    onSelect,
    value,
    getValue = extractTextContent,
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
                        // fix this later please, why button as div
                        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                        <div
                            // eslint-disable-next-line react/no-array-index-key
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

export { SelectField }
