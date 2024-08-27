import React from 'react'

import './UtilButton.css'

interface UtilButtonProps {
    onClick: () => void
}

const UtilButton: React.FC<UtilButtonProps> = ({ onClick }) => {
    const settingsSvg = `${process.env.PUBLIC_URL}/icons/settings.svg`

    return (
        <button className="util-button small-button" onClick={onClick} aria-label="utility info">
            <img src={settingsSvg} alt="settings" />
        </button>
    )
}

export default UtilButton
