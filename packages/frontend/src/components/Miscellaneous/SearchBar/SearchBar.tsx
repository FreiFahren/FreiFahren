import './SearchBar.css'

import React, { useEffect, useRef, useState } from 'react'
import { StationProperty } from 'src/utils/types'

import { sendAnalyticsEvent } from '../../../hooks/useAnalytics'
import { useStationSearch } from '../../../hooks/useStationSearch'

type SearchBarProps = {
    handleSelect: (station: StationProperty) => void
}

export const SearchBar: React.FC<SearchBarProps> = ({ handleSelect }) => {
    const [isSearchFocused, setIsSearchFocused] = useState(false)
    const { searchValue, setSearchValue, filteredStations } = useStationSearch('', 5)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setIsSearchFocused(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleStationSelect = (station: StationProperty) => {
        setSearchValue('')
        setIsSearchFocused(false)
        handleSelect(station)
        sendAnalyticsEvent('InfoModal opened', { meta: { source: 'stationSearch', station_name: station.name } })
    }

    return (
        <div className="search-container">
            <div className={`search-bar ${isSearchFocused ? 'focused' : ''}`}>
                <div className="search-icon">
                    <img src={`${process.env.PUBLIC_URL}/icons/search.svg`} alt="Search" />
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Hier suchen"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                />
            </div>

            {isSearchFocused ? (
                <div className="search-options" ref={dropdownRef}>
                    {Object.values(filteredStations).map((station) => (
                        <button
                            key={`station-${station.name}`}
                            className="station-option"
                            onClick={() => handleStationSelect(station)}
                            type="button"
                        >
                            <div className="station-name">{station.name}</div>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    )
}
