import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useTicketInspectors } from 'src/contexts/TicketInspectorsContext'
import { MarkerData } from 'src/utils/types'
import { getRecentDataWithIfModifiedSince } from 'src/utils/dbUtils'

import ReportsItem from './ReporItem'

import './ReportsModal.css'

interface ReportsModalProps {
    className?: string
}

type TabType = 'summary' | 'lines' | 'stations'

const ReportsModal: React.FC<ReportsModalProps> = ({ className }) => {
    const { t } = useTranslation()
    const [currentTab, setCurrentTab] = useState<TabType>('summary')

    const tabs: TabType[] = ['summary', 'lines', 'stations']

    const handleTabChange = (tab: TabType) => {
        setCurrentTab(tab)
    }

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

            const sortByTimestamp = (a: MarkerData, b: MarkerData): number =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()

            const sortedLists = [recentInspectors, historicInspectors, filteredPreviousDayInspectorList].map((list) =>
                list.sort(sortByTimestamp)
            )
            setTicketInspectorList(sortedLists.flat())
        }
        fetchInspectorList()
    }, [currentTime, lastHourInspectorList])

    return (
        <div className={`reports-modal modal container ${className}`}>
            <section className="align-child-on-line">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => handleTabChange(tab)}
                        className={currentTab === tab ? 'active' : ''}
                    >
                        <h3>{t(`ReportsModal.${tab}`)}</h3>
                    </button>
                ))}
            </section>
            <section>
                {currentTab === 'stations' && (
                    <div className="list-modal">
                        {ticketInspectorList.map((ticketInspector) => (
                            <ReportsItem
                                key={ticketInspector.station.id + ticketInspector.timestamp}
                                ticketInspector={ticketInspector}
                                currentTime={currentTime}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}

export default ReportsModal
