import './InfoModal.css'

import React from 'react'
import { StationProperty } from 'src/utils/types'
import { Line } from '../../Miscellaneous/Line/Line'

interface InfoModalProps {
    station: StationProperty | null
    className?: string
    children?: React.ReactNode
}

export const InfoModal: React.FC<InfoModalProps> = ({ station, className = '', children }) => {
    if (!station) return null

    return (
        <div className={`info-modal modal ${className}`}>
            {children}
            <div className="info-content">
                <div className="station-info">
                    <h1>{station.name}</h1>
                    <div className="lines-container">
                        {station.lines.map((line) => (
                            <Line key={line} line={line} />
                        ))}
                    </div>
                </div>
                <div className="route-container">
                    <button className="route-button">
                        <img src={`${process.env.PUBLIC_URL}/icons/route-svgrepo-com.svg`} alt="Route" />
                    </button>
                    <p className="route-text">Navigieren</p>
                </div>
            </div>
        </div>
    )
}
