import React from 'react'

import './ListButton.css'

interface ListButtonProps {
    onClick: () => void
}

const ListButton: React.FC<ListButtonProps> = ({ onClick }) => {
    return (
        <button className="list-button small-button streched" onClick={onClick}>
            <p>Liste</p>
        </button>
    )
}

export default ListButton
