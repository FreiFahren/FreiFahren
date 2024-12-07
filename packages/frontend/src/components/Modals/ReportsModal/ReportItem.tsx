import React from 'react'
import { useTranslation } from 'react-i18next'

import Line from '../../Miscellaneous/Line/Line'

import { Report } from 'src/utils/types'
import { useElapsedTimeMessage } from 'src/hooks/Messages'

const ReportItem: React.FC<{ ticketInspector: Report; currentTime: number }> = ({ ticketInspector, currentTime }) => {
    const { t } = useTranslation()
    const inspectorTimestamp = new Date(ticketInspector.timestamp).getTime()
    const elapsedTime = Math.floor((currentTime - inspectorTimestamp) / (60 * 1000)) // Convert to minutes
    const elapsedTimeMessage = useElapsedTimeMessage(elapsedTime, ticketInspector.isHistoric)

    return (
        <div key={ticketInspector.station.id + ticketInspector.timestamp} className="report-item">
            <div className="align-child-on-line">
                {ticketInspector.line && <Line line={ticketInspector.line} key={ticketInspector.line} />}
                <h4>{ticketInspector.station.name}</h4>
                <p>{elapsedTimeMessage}</p>
            </div>
            <div>
                <p>
                    {ticketInspector.direction?.name && (
                        <>
                            {t('MarkerModal.direction')}: <span>{ticketInspector.direction.name}</span>
                        </>
                    )}
                </p>
            </div>
        </div>
    )
}

export default ReportItem
