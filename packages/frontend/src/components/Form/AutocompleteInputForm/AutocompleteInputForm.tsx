import React from 'react'
import Select, { ActionMeta, StylesConfig } from 'react-select'

import { AutocompleteStyles } from './AutocompleteStyles'

export interface selectOption {
    value: string
    label: string
}

export function setStyles(
    isIndicatorSeparator: boolean | undefined,
    isDropdownIndicator: boolean | undefined
): StylesConfig {
    const colourStyles: StylesConfig = {
        control: (styles) => ({
            ...styles,
            marginTop: '2%',
            marginBottom: '2%',
            justifyContent: 'center',
            justifyItems: 'center',
            padding: '10px',
            fontSize: '0.9 em',
        }),
        indicatorSeparator: (base) => ({
            ...base,
            display: isIndicatorSeparator ? 'block' : 'none',
        }),
        dropdownIndicator: (defaultStyles) => ({
            ...defaultStyles,
            display: isDropdownIndicator ? 'block' : 'none',
        }),
    }

    return colourStyles
}

export interface AutocompleteInputFormProps {
    options: selectOption[]
    placeholder: React.ReactNode
    onChange: (value: selectOption | unknown, action: ActionMeta<unknown>) => void
    className: string
    value?: selectOption
    defaultInputValue: selectOption | unknown
    isIndicatorSeparator?: boolean
    isDropdownIndicator?: boolean
    isLoading?: boolean
    isDisabled?: boolean
    classNamePrefix?: string
}

export default function AutocompleteInputForm(props: AutocompleteInputFormProps) {
    const colourStyles = setStyles(props.isIndicatorSeparator, props.isDropdownIndicator)

    return (
        <>
            <div style={AutocompleteStyles}>
                <Select
                    className={props.className}
                    value={props.defaultInputValue}
                    isClearable={true}
                    noOptionsMessage={() => 'Keine Optionen'}
                    name="search"
                    options={props.options}
                    styles={colourStyles}
                    placeholder={props.placeholder}
                    onChange={props.onChange}
                    isDisabled={props.isDisabled}
                    id="autocomplete-input-form"
                    classNamePrefix={props.classNamePrefix}
                />
            </div>
        </>
    )
}
