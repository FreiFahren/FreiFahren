import './UtilButton.css'

import React from 'react'

interface UtilButtonProps {
    handleClick: () => void
}

const UtilButton: React.FC<UtilButtonProps> = ({ handleClick }) => {
    const settingsSvg = `/icons/settings.svg`

    return (
        <button className="util-button small-button" onClick={handleClick} aria-label="utility info" type="button">
            <img src={settingsSvg} alt="settings" />
        </button>
    )
}

export { UtilButton }
