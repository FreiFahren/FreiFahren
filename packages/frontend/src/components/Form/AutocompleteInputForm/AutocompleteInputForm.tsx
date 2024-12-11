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
    listHeight?: number | null
    highlightElements?: Record<string, T>
    setHighlightedElementSelected?: (highlightedElementSelected: boolean) => void
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
 * @param {number | null} [props.listHeight] - Optional height for the list container when not defined it will default standard css
 * @param {Array<T>} [props.highlightElements] - Optional array of elements to highlight in the list
 * @param {(highlightedElementSelected: boolean) => void} [props.setHighlightedElementSelected] - Optional callback to notify when a highlighted element is selected
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
    listHeight,
    highlightElements,
    setHighlightedElementSelected,
}: AutocompleteInputFormProps<T>) {
    const [showSearchBox, setShowSearchBox] = useState(false)
    const [elementIsSelected, setElementIsSelected] = useState(false)
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
        (selectedValue: string | null, isHighlighted: boolean = false) => {
            onSelect(selectedValue)
            setElementIsSelected(!elementIsSelected)
            setSearch('')
            setShowSearchBox(false)

            if (isHighlighted && setHighlightedElementSelected) {
                setHighlightedElementSelected(true)
            }
        },
        [onSelect, elementIsSelected, setHighlightedElementSelected]
    )

    const getHighlightedElementValue = (child: React.ReactElement) => {
        return child.props.children?.props?.children
    }

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
            <div
                className="list-container"
                style={listHeight ? { height: `${listHeight}px`, maxHeight: '100%' } : undefined}
            >
                {highlightElements && !elementIsSelected && !showSearchBox && (
                    <>
                        <SelectField
                            onSelect={(selectedValue) => handleSelect(selectedValue, true)}
                            value={value ? getDisplayValue(items[value]) : ''}
                            containerClassName="align-child-column highlight-list-container"
                            getValue={getHighlightedElementValue}
                        >
                            {Object.entries(highlightElements).map(([key, item]) => (
                                <div key={key}>
                                    <strong>{getDisplayValue(item)}</strong>
                                </div>
                            ))}
                        </SelectField>
                        <hr />
                    </>
                )}
                <SelectField
                    onSelect={handleSelect}
                    value={value ? getDisplayValue(items[value]) : ''}
                    containerClassName="align-child-column"
                    getValue={getHighlightedElementValue}
                >
                    {filteredItems.map(([key, item]) => (
                        <div key={key}>
                            <strong>{getDisplayValue(item)}</strong>
                        </div>
                    ))}
                </SelectField>
            </div>
        </section>
    )
}

export default AutocompleteInputForm
