import React, { useEffect, useRef, useState } from 'react'
import './SearchBar.css'
import { useStationSearch } from '../../../hooks/useStationSearch'

export const SearchBar: React.FC = () => {
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
                    onChange={(e) => setSearchValue(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                />
                <div className="navigation-icon">
                    <img src={`${process.env.PUBLIC_URL}/icons/route-svgrepo-com.svg`} alt="Navigation" />
                </div>
            </div>

            {isSearchFocused && (
                <div className="search-options" ref={dropdownRef}>
                    {Object.values(filteredStations).map((station, index) => (
                        <div
                            key={`station-${index}`}
                            className="station-option"
                            onClick={() => {
                                setSearchValue(station.name)
                                setIsSearchFocused(false)
                            }}
                        >
                            <div className="station-name">{station.name}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
