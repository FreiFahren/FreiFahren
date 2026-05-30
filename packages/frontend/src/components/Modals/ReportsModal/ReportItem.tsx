import React from 'react'
import { useTranslation } from 'react-i18next'
import { useStations } from 'src/api/queries'
import { useElapsedTimeMessage } from 'src/hooks/Messages'
import { Report } from 'src/utils/types'

import { Line } from '../../Miscellaneous/Line/Line'

interface ReportItemProps {
    report: Report
    currentTime?: number // optional to avoid showing the timestamp if it is redudant
}

const ReportItem: React.FC<ReportItemProps> = ({ report, currentTime }) => {
    const { t } = useTranslation()
    const { data: stations } = useStations()

    const elapsedTimeMessage = useElapsedTimeMessage(report.timestamp, report.isPredicted)
    const shouldShowTime = currentTime !== undefined
    const displayMessage = shouldShowTime ? elapsedTimeMessage : null

    const stationName = stations?.[report.stationId]?.name ?? report.stationId
    const directionName =
        report.directionId !== null ? (stations?.[report.directionId]?.name ?? report.directionId) : null

    return (
        <div key={report.stationId + report.timestamp} className="report-item">
            <div className="align-child-on-line">
                {report.lineId !== null ? <Line line={report.lineId} key={report.lineId} /> : null}
                <h4>{stationName}</h4>
                {displayMessage ? <p>{displayMessage}</p> : null}
            </div>
            <div>
                <p className="report-item-direction">
                    {/* BECAUSE IF NULL, empty richtung is shown  */}
                    {directionName !== null ? (
                        <>
                            {t('MarkerModal.direction')}: <span>{directionName}</span>
                        </>
                    ) : null}
                </p>
            </div>
        </div>
    )
}

export { ReportItem }
