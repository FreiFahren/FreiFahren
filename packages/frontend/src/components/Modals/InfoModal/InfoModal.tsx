import './InfoModal.css'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useReportsByStation, useStations } from 'src/api/queries'
import { Line } from 'src/components/Miscellaneous/Line/Line'
import { StationProperty } from 'src/utils/types'

import { ReportItem } from '../ReportsModal/ReportItem'

interface InfoModalProps {
    station: StationProperty
    className?: string
    children?: React.ReactNode
    onRouteClick?: () => void
}

export const InfoModal: React.FC<InfoModalProps> = ({ station, className = '', children, onRouteClick }) => {
    const { t } = useTranslation()

    const { data: stations } = useStations()
    const stationId = useMemo(
        () => Object.keys(stations ?? {}).find((key) => stations?.[key]?.name === station.name) ?? '',
        [stations, station.name]
    )

    const now = useMemo(() => new Date(), [])
    const oneMonthAgo = useMemo(() => {
        const date = new Date(now)
        date.setMonth(date.getMonth() - 1)
        return date
    }, [now])

    const { data: reports } = useReportsByStation(stationId, oneMonthAgo.toISOString(), now.toISOString())

    const currentTime = new Date().getTime()

    const handleRouteClick = () => {
        onRouteClick?.()
    }

    return (
        <div className={`info-modal modal ${className}`}>
            {children}
            <section className="info-content">
                <div className="station-info">
                    <h1>{station.name}</h1>
                    <div className="lines-container">
                        {station.lines.map((line) => (
                            <Line key={line} line={line} />
                        ))}
                    </div>
                </div>
                <div className="route-container">
                    <button type="button" className="route-button" onClick={handleRouteClick}>
                        <img src={`${process.env.PUBLIC_URL}/icons/route-svgrepo-com.svg`} alt="Route" />
                    </button>
                    <p className="route-text">{t('InfoModal.route')}</p>
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
