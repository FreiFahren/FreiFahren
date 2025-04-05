import './InfoModal.css'

import React, { useRef } from 'react'
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

    const nowRef = useRef(new Date())
    const oneMonthAgoRef = useRef(
        new Date(nowRef.current.getFullYear(), nowRef.current.getMonth() - 1, nowRef.current.getDate())
    )
    const { data: reports } = useReportsByStation(
        stationId,
        oneMonthAgoRef.current.toISOString(),
        nowRef.current.toISOString()
    )

    const currentTime = new Date().getTime()

    return (
        <div className={`info-modal modal ${className}`}>
            {children}
            <section className="info-content">
                <div className="station-info">
                    <h1>{station.name}</h1>
                </div>
                <div className="route-container">
                    <button className="route-button" onClick={onRouteClick}>
                        <img src={`${process.env.PUBLIC_URL}/icons/route-svgrepo-com.svg`} alt="Route" />
                    </button>
                    <p className="route-text">Navigieren</p>
                </div>
            </section>
            <section className="frequency-container">
                <h2>{t('InfoModal.frequency')}</h2>
                <div className="frequency-items align-child-on-line">
                    <div>
                        <p>{Math.round((reports?.length ?? 0) / 30)}</p>
                        <p>{t('InfoModal.daily')}</p>
                    </div>
                    <div>
                        <p>{Math.round((reports?.length ?? 0) / 7)}</p>
                        <p>{t('InfoModal.weekly')}</p>
                    </div>
                    <div>
                        <p>{reports?.length}</p>
                        <p>{t('InfoModal.monthly')}</p>
                    </div>
                </div>
            </section>
            <section className="reports-container">
                <h2>{t('InfoModal.lastReports')}</h2>
                {reports
                    ?.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .slice(0, 3)
                    .map((report) => (
                        <ReportItem key={report.timestamp} report={report} currentTime={currentTime} />
                    ))}
            </section>
        </div>
    )
}
