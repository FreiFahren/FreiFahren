import React from 'react'

import './InspectorListButton.css'

interface InspectorListButtonProps {
    onClick: () => void
}

const InspectorListButton: React.FC<InspectorListButtonProps> = ({ onClick }) => {
    return (
        <button className="list-button small-button streched align-child-on-line" onClick={onClick}>
            <img className="svg" src={`${process.env.PUBLIC_URL}/icons/list.svg`} alt="list button" />
            <p>Liste</p>
        </button>
    )
}

export default InspectorListButton
