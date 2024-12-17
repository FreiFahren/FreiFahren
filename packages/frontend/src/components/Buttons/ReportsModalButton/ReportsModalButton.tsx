import React from 'react'
import { useTranslation } from 'react-i18next'

import { useTicketInspectors } from 'src/contexts/TicketInspectorsContext'
import { sendAnalyticsEvent } from 'src/hooks/useAnalytics'
import { useViewedReports } from 'src/contexts/ViewedReportsContext'

import Line from '../../Miscellaneous/Line/Line'

import './ReportsModalButton.css'

interface ReportsModalButtonProps {
    openModal: () => void
}

const ReportsModalButton: React.FC<ReportsModalButtonProps> = ({ openModal }) => {
    const { t } = useTranslation()
    const { ticketInspectorList } = useTicketInspectors()
    const { setLastViewed, isRecentAndUnviewed } = useViewedReports()

    const latestReport =
        ticketInspectorList.length > 0
            ? ticketInspectorList.reduce((latest, current) => {
                  const currentTime = new Date(current.timestamp).getTime()
                  const latestTime = new Date(latest.timestamp).getTime()
                  return currentTime > latestTime ? current : latest
              }, ticketInspectorList[0])
            : null

    const handleClick = () => {
        openModal()
        if (latestReport) {
            setLastViewed(latestReport)
        }
        sendAnalyticsEvent('ReportsModal opened', {})
    }

    return (
        <button className="list-button small-button align-child-on-line" onClick={handleClick}>
            <div className="list-button-content">
                <div className="list-button-header">
                    <p>{t('InspectorListButton.label')}</p>
                    <p>{ticketInspectorList.length}</p>
                </div>
                {latestReport && (
                    <div className="latest-report">
                        {latestReport.line && <Line line={latestReport.line} />}
                        <p className="station-name">{latestReport.station.name}</p>
                        {isRecentAndUnviewed(latestReport) && <span className="indicator live pulse" />}
                    </div>
                )}
            </div>
        </button>
    )
}

export default ReportsModalButton
