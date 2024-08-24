import React, { useState, useMemo, useEffect, useRef } from 'react'

import { MarkerData } from 'src/utils/types'
import { getRecentDataWithIfModifiedSince } from 'src/utils/dbUtils'
import './ListModal.css'

interface ListModalProps {
    className?: string
}

const ListModal: React.FC<ListModalProps> = ({ className }) => {
    const [ticketInspectorList, setTicketInspectorList] = useState<MarkerData[]>([])
    const lastReceivedInspectorTime = useRef<Date | null>(null)

    const currentTime = useMemo(() => new Date().getTime(), [])
    useEffect(() => {
        const fetchInspectorList = async () => {
            const startTimeInRFC3339 = new Date(currentTime - 1000 * 60 * 60 * 24).toISOString()
            const endTimeInRFC3339 = new Date(currentTime).toISOString()

            const inspectorList =
                (await getRecentDataWithIfModifiedSince(
                    `${process.env.REACT_APP_API_URL}/basics/inspectors?start=${startTimeInRFC3339}&end=${endTimeInRFC3339}`,
                    lastReceivedInspectorTime.current
                )) || [] // in case the server returns, 304 Not Modified

            // sort to make it easier for the user to find the most recent entries
            const sortedList = inspectorList.sort((a: MarkerData, b: MarkerData) => {
                return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            })
            setTicketInspectorList(sortedList)
            lastReceivedInspectorTime.current = new Date(sortedList[0].timestamp)
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
                            {ticketInspector.line && <h4 className="S41 line-label">{ticketInspector.line}</h4>}
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
