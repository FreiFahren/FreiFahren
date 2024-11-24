import React from 'react'
import { useTranslation } from 'react-i18next'
import { useTicketInspectors } from 'src/contexts/TicketInspectorsContext'
import { getLineColor } from 'src/utils/uiUtils'
import { sendAnalyticsEvent } from 'src/utils/analytics'

import './ReportsModalButton.css'

interface ReportsModalButtonProps {
    openModal: () => void
}

const ReportsModalButton: React.FC<ReportsModalButtonProps> = ({ openModal }) => {
    const { t } = useTranslation()
    const { ticketInspectorList } = useTicketInspectors()

    const handleClick = () => {
        openModal()
        sendAnalyticsEvent('ReportsModal opened', {})
    }

    const latestReport = ticketInspectorList[0]

    return (
        <button className="list-button small-button align-child-on-line" onClick={handleClick}>
            <div className="list-button-content">
                <div className="list-button-header">
                    <p>{t('InspectorListButton.label')}</p>
                    <p>{ticketInspectorList.length}</p>
                </div>
                {latestReport && (
                    <div className="latest-report">
                        {latestReport.line && (
                            <span className="line-label" style={{ backgroundColor: getLineColor(latestReport.line) }}>
                                {latestReport.line}
                            </span>
                        )}
                        <p className="station-name">{latestReport.station.name}</p>
                    </div>
                )}
            </div>
        </button>
    )
}

export default ReportsModalButton
