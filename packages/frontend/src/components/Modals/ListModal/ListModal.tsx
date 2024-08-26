import React, { useState, useMemo, useEffect } from 'react'

import { MarkerData } from 'src/utils/types'
import { getRecentDataWithIfModifiedSince } from 'src/utils/dbUtils'
import './ListModal.css'

interface ListModalProps {
    className?: string
}

const ListModal: React.FC<ListModalProps> = ({ className }) => {
    const [ticketInspectorList, setTicketInspectorList] = useState<MarkerData[]>([])

    const currentTime = useMemo(() => new Date().getTime(), [])
    useEffect(() => {
        const fetchInspectorList = async () => {
            const startTimeInRFC3339 = new Date(currentTime - 1000 * 60 * 60 * 24).toISOString()
            const endTimeInRFC3339 = new Date(currentTime - 1000 * 60 * 60).toISOString()

            // Request them seperately to ensure that the list will contain the currently display historic data
            // otherwise the historic data would not be included as the 24 hour request would be above the historic data threshold
            const previousDayInspectorList =
                (await getRecentDataWithIfModifiedSince(
                    `${process.env.REACT_APP_API_URL}/basics/inspectors?start=${startTimeInRFC3339}&end=${endTimeInRFC3339}`,
                    null // no caching to make it less error prone
                )) || [] // in case the server returns, 304 Not Modified

            // in order to ensure that the list will contain the currently display historic data
            const lastHourInspectorList =
                (await getRecentDataWithIfModifiedSince(`${process.env.REACT_APP_API_URL}/basics/inspectors`, null)) ||
                []

            const inspectorList = [...lastHourInspectorList, ...previousDayInspectorList]

            setTicketInspectorList(inspectorList)
        }
        fetchInspectorList()
    }, [currentTime])

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
                                vor {elapsedTime} min
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

export default ListModal
