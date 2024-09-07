import React, { useState, useRef, useCallback } from 'react'

import SelectField from '../SelectField/SelectField'

import './AutocompleteInputForm.css'

interface AutocompleteInputFormProps<T> {
    items: Record<string, T>
    onSelect: (key: string | null) => void
    value: string | null
    getDisplayValue: (item: T) => string
    placeholder: string
    label: string
    required?: boolean
    setSearchUsed?: (searchUsed: boolean) => void
}

const search_icon = `${process.env.PUBLIC_URL}/icons/search.svg`

/**
 * AutocompleteInputForm Component
 *
 * This component provides an autocomplete input form with search functionality.
 * It allows users to select an item from a list, with the ability to filter items through a search box.
 *
 * @template T - The type of items in the autocomplete list
 *
 * @param {Object} props - The component props
 * @param {Record<string, T>} props.items - An object containing the items to be displayed in the autocomplete list
 * @param {(key: string | null) => void} props.onSelect - Callback function called when an item is selected
 * @param {string | null} props.value - The currently selected value
 * @param {(item: T) => string} props.getDisplayValue - Function to get the display value for each item
 * @param {string} props.placeholder - Placeholder text for the input field
 * @param {string} props.label - Label for the input field
 * @param {boolean} [props.required=false] - Whether the field is required
 * @param {(searchUsed: boolean) => void} [props.setSearchUsed] - Optional callback to notify when search is used
 *
 * @returns {React.ReactElement} The rendered AutocompleteInputForm component
 */
function AutocompleteInputForm<T>({
    items,
    onSelect,
    value,
    getDisplayValue,
    placeholder,
    label,
    required = false,
    setSearchUsed,
}: AutocompleteInputFormProps<T>) {
    const [showSearchBox, setShowSearchBox] = useState(false)
    const [search, setSearch] = useState('')
    const searchInputRef = useRef<HTMLInputElement>(null)

    const toggleSearchBox = useCallback(() => {
        setShowSearchBox((prev) => !prev)
        setTimeout(() => {
            // slight delay to make sure the input is rendered
            if (searchInputRef.current) {
                searchInputRef.current.focus()
            }
        }, 100)

        // notify parent for analytics
        if (setSearchUsed) {
            setSearchUsed(true)
        }
    }, [setSearchUsed])

    const filteredItems = Object.entries(items).filter(([, item]) =>
        getDisplayValue(item).toLowerCase().includes(search.toLowerCase())
    )

    const handleSelect = useCallback(
        (selectedValue: string | null) => {
            onSelect(selectedValue)
            setSearch('')
            setShowSearchBox(false)
        },
        [onSelect]
    )

    return (
        <section>
            <div className="align-child-on-line" id="searchable-select-div">
                <h2>
                    {label} {required && <span className="red-highlight">*</span>}
                </h2>
                <input
                    className={`search-input ${showSearchBox ? 'expanded' : ''}`}
                    type="text"
                    placeholder={placeholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    ref={searchInputRef}
                />
                <img src={search_icon} onClick={toggleSearchBox} alt="Search icon" />
            </div>
            <SelectField
                onSelect={handleSelect}
                value={value ? getDisplayValue(items[value]) : ''}
                containerClassName="align-child-column"
            >
                {filteredItems.map(([key, item]) => (
                    <div key={key}>
                        <strong>{getDisplayValue(item)}</strong>
                    </div>
                ))}
            </SelectField>
        </section>
    )
}

export default AutocompleteInputForm
