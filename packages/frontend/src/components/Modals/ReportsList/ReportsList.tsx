import React, { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MarkerData } from 'src/utils/types'
import { getRecentDataWithIfModifiedSince } from 'src/utils/dbUtils'
import { useElapsedTimeMessage } from 'src/hooks/Messages'
import { useTicketInspectors } from 'src/contexts/TicketInspectorsContext'

import './ReportsList.css'

interface ReportsListProps {
    className?: string
}

const ReportsItem: React.FC<{ ticketInspector: MarkerData; currentTime: number }> = ({
    ticketInspector,
    currentTime,
}) => {
    const { t } = useTranslation()
    const inspectorTimestamp = new Date(ticketInspector.timestamp).getTime()
    const elapsedTime = Math.floor((currentTime - inspectorTimestamp) / (60 * 1000)) // Convert to minutes
    const elapsedTimeMessage = useElapsedTimeMessage(elapsedTime, ticketInspector.isHistoric)

    return (
        <div key={ticketInspector.station.id + ticketInspector.timestamp}>
            <div className="align-child-on-line">
                {ticketInspector.line && (
                    <h4 className={`${ticketInspector.line} line-label`}>{ticketInspector.line}</h4>
                )}
                <h4>{ticketInspector.station.name}</h4>
            </div>
            <div>
                <p>
                    {elapsedTimeMessage}
                    {ticketInspector.direction.name && (
                        <>
                            , {t('MarkerModal.direction')}: <span>{ticketInspector.direction.name}</span>
                        </>
                    )}
                </p>
            </div>
        </div>
    )
}

const ReportsList: React.FC<ReportsListProps> = ({ className }) => {
    const [ticketInspectorList, setTicketInspectorList] = useState<MarkerData[]>([])
    const { ticketInspectorList: lastHourInspectorList } = useTicketInspectors() // inorder to keep the list in sync with the currently displayed data

    const currentTime = useMemo(() => new Date().getTime(), [])

    useEffect(() => {
        const fetchInspectorList = async () => {
            const startTimeInRFC3339 = new Date(currentTime - 1000 * 60 * 60 * 24).toISOString()
            const endTimeInRFC3339 = new Date(currentTime - 1000 * 60 * 60).toISOString()

            const previousDayInspectorList =
                (await getRecentDataWithIfModifiedSince(
                    `${process.env.REACT_APP_API_URL}/basics/inspectors?start=${startTimeInRFC3339}&end=${endTimeInRFC3339}`,
                    null // no caching to make it less error prone
                )) || [] // in case the server returns, 304 Not Modified

            // Separate historic inspectors from lastHourInspectorList
            const historicInspectors = lastHourInspectorList.filter((inspector) => inspector.isHistoric)
            const recentInspectors = lastHourInspectorList.filter((inspector) => !inspector.isHistoric)

            // remove historic inspectors from previousDayInspectorList
            const filteredPreviousDayInspectorList = previousDayInspectorList.filter(
                (inspector: MarkerData) => !inspector.isHistoric
            )

            // sort each list so that the most recent data is at the top
            recentInspectors.sort(
                (a: MarkerData, b: MarkerData) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )
            historicInspectors.sort(
                (a: MarkerData, b: MarkerData) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )
            filteredPreviousDayInspectorList.sort(
                (a: MarkerData, b: MarkerData) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )

            // Combine the lists so that first are the recent inspectors, then the historic inspectors and then the previous day inspectors
            const inspectorList = [...recentInspectors, ...historicInspectors, ...filteredPreviousDayInspectorList]

            setTicketInspectorList(inspectorList)
        }
        fetchInspectorList()
    }, [currentTime, lastHourInspectorList])

    return (
        <div className={`list-modal modal container ${className}`}>
            <h1>Aktuelle Meldungen</h1>
            {ticketInspectorList.map((ticketInspector) => (
                <ReportsItem
                    key={ticketInspector.station.id + ticketInspector.timestamp}
                    ticketInspector={ticketInspector}
                    currentTime={currentTime}
                />
            ))}
        </div>
    )
}

export default ReportsList
