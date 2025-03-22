import React from 'react'
import './SearchBar.css'

type SearchBarProps = {
    onSearchOpen: () => void
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearchOpen }) => {
    return (
        <button className="search-bar" onClick={onSearchOpen}>
            <input type="text" placeholder="Hier suchen" readOnly />
            <div className="search-icon">
                <img src={`${process.env.PUBLIC_URL}/icons/search.svg`} alt="Search" />
            </div>
            <div className="navigation-icon">
                <img src={`${process.env.PUBLIC_URL}/icons/route-svgrepo-com.svg`} alt="Navigation" />
            </div>
        </button>
    )
}
