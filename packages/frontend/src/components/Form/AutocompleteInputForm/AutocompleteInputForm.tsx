import './AutocompleteInputForm.css'

import React, { useCallback, useRef, useState } from 'react'

import { SelectField } from '../SelectField/SelectField'

interface AutocompleteInputFormProps<T> {
    items: Record<string, T>
    onSelect: (key: string | null) => void
    value: string | null
    getDisplayValue: (item: T) => string
    placeholder?: string
    label?: string
    required?: boolean
    setSearchUsed?: (searchUsed: boolean) => void
    highlightElements?: Record<string, T>
    setHighlightedElementSelected?: (highlightedElementSelected: boolean) => void
}

interface HighlightedElementProps {
    children: {
        props: {
            children: string
        }
    }
}

const SEARCH_ICON = `${process.env.PUBLIC_URL}/icons/search.svg`

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
 * @param {Array<T>} [props.highlightElements] - Optional array of elements to highlight in the list
 * @param {(highlightedElementSelected: boolean) => void} [props.setHighlightedElementSelected] - Optional callback to notify when a highlighted element is selected
 *
 * @returns {React.ReactElement} The rendered AutocompleteInputForm component
 */
const AutocompleteInputForm = <T,>({
    items,
    onSelect,
    value,
    getDisplayValue,
    placeholder,
    label,
    required = false,
    setSearchUsed,
    highlightElements,
    setHighlightedElementSelected,
}: AutocompleteInputFormProps<T>) => {
    const [showSearchBox, setShowSearchBox] = useState(false)
    const [elementIsSelected, setElementIsSelected] = useState(false)
    const [search, setSearch] = useState('')
    const searchInputRef = useRef<HTMLInputElement>(null)

    const handleToggleSearchBox = useCallback(() => {
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

    const getHighlightedElementValue = (child: React.ReactElement): string =>
        (child.props as HighlightedElementProps).children.props.children

    return (
        <section>
            <div className="align-child-on-line" id="searchable-select-div">
                {label !== undefined && label !== '' ? (
                    <h2>
                        {label} {required ? <span className="red-highlight">*</span> : null}
                    </h2>
                ) : undefined}
                {placeholder !== undefined && placeholder !== '' ? (
                    <>
                        <input
                            className={`search-input ${showSearchBox ? 'expanded' : ''}`}
                            type="text"
                            placeholder={placeholder}
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            ref={searchInputRef}
                        />
                        <button
                            type="button"
                            className="search-icon-button"
                            onClick={handleToggleSearchBox}
                            aria-label="Toggle search box"
                        >
                            <img src={SEARCH_ICON} alt="Search icon" />
                        </button>
                    </>
                ) : undefined}
            </div>
            <div className={`list-container ${value !== null ? 'has-selection' : ''}`}>
                {highlightElements && !elementIsSelected && !showSearchBox ? (
                    <>
                        <SelectField
                            onSelect={(selectedValue) => handleSelect(selectedValue, true)}
                            value={value !== null ? getDisplayValue(items[value]) : ''}
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
                ) : null}
                <SelectField
                    onSelect={handleSelect}
                    value={value !== null ? getDisplayValue(items[value]) : ''}
                    containerClassName="align-child-column"
                    getValue={getHighlightedElementValue}
                >
                    {filteredItems.map(([key, item]) => (
                        <div key={key} data-value={getDisplayValue(item)}>
                            <strong>{getDisplayValue(item)}</strong>
                        </div>
                    ))}
                </SelectField>
            </div>
        </section>
    )
}

export default AutocompleteInputForm
