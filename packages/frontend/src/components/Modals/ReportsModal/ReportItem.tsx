import React from 'react'
import { useTranslation } from 'react-i18next'

import Line from '../../Miscellaneous/Line/Line'

import { Report } from 'src/utils/types'
import { useElapsedTimeMessage } from 'src/hooks/Messages'

interface ReportItemProps {
    report: Report
    currentTime?: number // optional to avoid showing the timestamp if it is redudant
}

const ReportItem: React.FC<ReportItemProps> = ({ report, currentTime }) => {
    const { t } = useTranslation()

    let elapsedTimeMessage = null

    if (currentTime) {
        elapsedTimeMessage = useElapsedTimeMessage(report.timestamp, report.isHistoric)
    } 

    return (
        <div key={report.station.id + report.timestamp} className="report-item">
            <div className="align-child-on-line">
                {report.line && <Line line={report.line} key={report.line} />}
                <h4>{report.station.name}</h4>
                {elapsedTimeMessage && <p>{elapsedTimeMessage}</p>}
            </div>
            <div>
                <p>
                    {report.direction?.name && (
                        <>
                            {t('MarkerModal.direction')}: <span>{report.direction.name}</span>
                        </>
                    )}
                </p>
            </div>
        </div>
    )
}

export default ReportItem
