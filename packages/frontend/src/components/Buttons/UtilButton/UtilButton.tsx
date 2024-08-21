import React from 'react'

import './UtilButton.css'

interface UtilButtonProps {
    onClick: () => void
}

const UtilButton: React.FC<UtilButtonProps> = ({ onClick }) => {
    return (
        <button className="util-button small-button" onClick={onClick} aria-label="utility info">
            <span />
            <span />
            <span />
        </button>
    )
}

export default UtilButton
