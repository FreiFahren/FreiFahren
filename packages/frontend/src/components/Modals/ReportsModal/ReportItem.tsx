import React from 'react'
import { useTranslation } from 'react-i18next'
import { useElapsedTimeMessage } from 'src/hooks/Messages'
import { Report } from 'src/utils/types'

import { Line } from '../../Miscellaneous/Line/Line'

interface ReportItemProps {
    report: Report
    currentTime?: number // optional to avoid showing the timestamp if it is redudant
}

const ReportItem: React.FC<ReportItemProps> = ({ report, currentTime }) => {
    const { t } = useTranslation()

    const elapsedTimeMessage = useElapsedTimeMessage(report.timestamp, report.isHistoric)
    const shouldShowTime = currentTime !== undefined
    const displayMessage = shouldShowTime ? elapsedTimeMessage : null

    return (
        <div key={report.station.id + report.timestamp} className="report-item">
            <div className="align-child-on-line">
                {report.line !== null ? <Line line={report.line} key={report.line} /> : null}
                <h4>{report.station.name}</h4>
                {displayMessage ? <p>{displayMessage}</p> : null}
            </div>
            <div>
                <p className="report-item-direction">
                    {/* BECAUSE IF NULL, empty richtung is shown  */}
                    {/* eslint-disable-next-line @typescript-eslint/strict-boolean-expressions */}
                    {report.direction?.name ? (
                        <>
                            {t('MarkerModal.direction')}: <span>{report.direction.name}</span>
                        </>
                    ) : null}
                </p>
            </div>
        </div>
    )
}

export { ReportItem }
