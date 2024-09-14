import React from 'react'

import { sendAnalyticsEvent } from 'src/utils/analytics'

import './InspectorListButton.css'

interface InspectorListButtonProps {
    closeModal: () => void
}

const InspectorListButton: React.FC<InspectorListButtonProps> = ({ closeModal }) => {
    const handleClick = () => {
        closeModal()
        sendAnalyticsEvent('InspectorList opened', {})
    }

    return (
        <button className="list-button small-button align-child-on-line" onClick={handleClick}>
            <img className="svg" src={`${process.env.PUBLIC_URL}/icons/list.svg`} alt="list button" />
            <p>Meldungen</p>
        </button>
    )
}

export default InspectorListButton
