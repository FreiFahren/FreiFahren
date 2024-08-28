import React, { useState, useMemo, useEffect } from 'react'

import { MarkerData } from 'src/utils/types'
import { getRecentDataWithIfModifiedSince } from 'src/utils/dbUtils'
import { elapsedTimeMessage } from 'src/utils/uiUtils'
import { useTicketInspectors } from 'src/contexts/TicketInspectorsContext'
import './InspectorListModal.css'

interface InspectorListModalProps {
    className?: string
}

const InspectorListModal: React.FC<InspectorListModalProps> = ({ className }) => {
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

            // sort each list so that the most recent data is at the top
            recentInspectors.sort(
                (a: MarkerData, b: MarkerData) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )
            historicInspectors.sort(
                (a: MarkerData, b: MarkerData) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )
            previousDayInspectorList.sort(
                (a: MarkerData, b: MarkerData) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )

            // Combine the lists so that first are the recent inspectors, then the historic inspectors and then the previous day inspectors
            const inspectorList = [...recentInspectors, ...historicInspectors, ...previousDayInspectorList]

            setTicketInspectorList(inspectorList)
        }
        fetchInspectorList()
    }, [currentTime, lastHourInspectorList])

    return (
        <div className={`list-modal modal container ${className}`}>
            <h1>Aktuelle Meldungen</h1>
            {ticketInspectorList.map((ticketInspector) => {
                const inspectorTimestamp = new Date(ticketInspector.timestamp).getTime()
                const elapsedTime = Math.floor((currentTime - inspectorTimestamp) / 60000) // Convert to minutes
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
                                {elapsedTimeMessage(elapsedTime)}
                                {ticketInspector.direction.name && (
                                    <>
                                        , Richtung: <span>{ticketInspector.direction.name}</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

export default InspectorListModal
