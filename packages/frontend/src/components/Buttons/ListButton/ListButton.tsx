import React from 'react'

import './ListButton.css'

interface ListButtonProps {
    onClick: () => void
}

const ListButton: React.FC<ListButtonProps> = ({ onClick }) => {
    return (
        <button className="list-button small-button streched align-child-on-line" onClick={onClick}>
            <img className="svg" src={`${process.env.PUBLIC_URL}/icons/list.svg`} />
            <p>Liste</p>
        </button>
    )
}

export default ListButton
