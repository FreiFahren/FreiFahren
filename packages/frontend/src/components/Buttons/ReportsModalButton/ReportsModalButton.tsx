import './ReportsModalButton.css'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentReports } from 'src/api/queries'
import { useViewedReports } from 'src/contexts/ViewedReportsContext'
import { sendAnalyticsEvent } from 'src/hooks/useAnalytics'

import { Line } from '../../Miscellaneous/Line/Line'

interface ReportsModalButtonProps {
    openModal: () => void
}

const ReportsModalButton: React.FC<ReportsModalButtonProps> = ({ openModal }) => {
    const { t } = useTranslation()
    const { data: lastHourReports } = useCurrentReports()
    const { setLastViewed, isRecentAndUnviewed } = useViewedReports()

    const latestReport =
        lastHourReports.length > 0
            ? lastHourReports.reduce((latest, current) => {
                  const currentTime = new Date(current.timestamp).getTime()
                  const latestTime = new Date(latest.timestamp).getTime()

                  return currentTime > latestTime ? current : latest
              }, lastHourReports[0])
            : null

    const handleClick = () => {
        openModal()
        if (latestReport) {
            setLastViewed(latestReport)
        }
        sendAnalyticsEvent('ReportsModal opened', {}).catch((error) => {
            // fix this later with sentry
            // eslint-disable-next-line no-console
            console.error('Error sending analytics event', error)
        })
    }

    return (
        <button className="list-button small-button align-child-on-line" onClick={handleClick} type="button">
            <div className="list-button-content">
                <div className="list-button-header">
                    <p>{t('InspectorListButton.label')}</p>
                    <p>{lastHourReports.length}</p>
                </div>
                {latestReport ? (
                    <div className="latest-report">
                        {latestReport.line !== null ? <Line line={latestReport.line} /> : null}
                        <p className="station-name">{latestReport.station.name}</p>
                        {isRecentAndUnviewed(latestReport) ? <span className="indicator live pulse" /> : null}
                    </div>
                ) : null}
            </div>
        </button>
    )
}

export { ReportsModalButton }
