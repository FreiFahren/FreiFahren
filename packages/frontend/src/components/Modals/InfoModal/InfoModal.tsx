import './InfoModal.css'

import React from 'react'
import { StationProperty } from 'src/utils/types'
import { useTranslation } from 'react-i18next'
import { useReportsByStation, useStations } from 'src/api/queries'
import { ReportItem } from '../ReportsModal/ReportItem'

interface InfoModalProps {
    station: StationProperty
    className?: string
    children?: React.ReactNode
    onRouteClick?: () => void
}

export const InfoModal: React.FC<InfoModalProps> = ({ station, className = '', children, onRouteClick }) => {
    const { t } = useTranslation()

    // todo: refactor once station.id exists
    const { data: stations } = useStations()
    const stationId = stations ? Object.keys(stations).find((key) => stations[key].name === station.name) || '' : ''
    const { data: reports } = useReportsByStation(stationId)

    const currentTime = new Date().getTime()

    return (
        <div className={`info-modal modal ${className}`}>
            {children}
            <div className="info-content">
                <div className="station-info">
                    <h1>{station.name}</h1>
                </div>
                <div className="route-container">
                    <button className="route-button" onClick={onRouteClick}>
                        <img src={`${process.env.PUBLIC_URL}/icons/route-svgrepo-com.svg`} alt="Route" />
                    </button>
                    <p className="route-text">Navigieren</p>
                </div>
            </div>
            <div className="reports-container">
                <h2>{t('InfoModal.lastReports')}</h2>
                {reports
                    ?.slice(0, 3)
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((report) => (
                        <ReportItem key={report.timestamp} report={report} currentTime={currentTime} />
                    ))}
            </div>
        </div>
    )
}
