import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useTicketInspectors } from 'src/contexts/TicketInspectorsContext'
import { MarkerData } from 'src/utils/types'
import { getRecentDataWithIfModifiedSince } from 'src/utils/dbUtils'

import ReportItem from './ReportItem'
import ClusteredReportItem from './ClusteredReportItem'

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
    const { ticketInspectorList: lastHourInspectorList } = useTicketInspectors()

    const currentTime = useMemo(() => new Date().getTime(), [])

    useEffect(() => {
        /**
         * Fetches and processes ticket inspector data for the last 24 hours.
         *
         * This function performs the following tasks:
         * 1. Retrieves inspector data from 24 hours ago to 1 hour ago via the API.
         *    This approach ensures we capture historic data that may not be included
         *    when fetching the full 24-hour period due to data thresholds.
         * 2. Separates recent and historic inspectors from the last hour's data.
         * 3. Excludes historic inspectors from the previous day's data to cover edge cases.
         * 4. Sorts all inspector lists chronologically, with most recent entries first.
         *    The order is last hour, historic, previous day.
         * 5. Merges and flattens the sorted lists into a single, comprehensive dataset.
         *
         * The processed list is then stored in the component's state via setTicketInspectorList.
         *
         * @async
         * @function
         * @returns {Promise<void>}
         */
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

    const [sortedLinesWithReports, setSortedLinesWithReports] = useState<Map<string, MarkerData[]>>(new Map())

    useEffect(() => {
        const getAllLinesWithReportsSorted = (): Map<string, MarkerData[]> => {
            const lineCounts = new Map<string, number>()
            const lineReports = new Map<string, MarkerData[]>()

            for (const inspector of ticketInspectorList) {
                const { line } = inspector
                if (line === '') continue

                lineCounts.set(line, (lineCounts.get(line) || 0) + 1)
                lineReports.set(line, [...(lineReports.get(line) || []), inspector])
            }

            // sort lines by count of reports
            return new Map(
                Array.from(lineCounts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([line]) => [line, lineReports.get(line)!])
            )
        }

        const sortedLines = getAllLinesWithReportsSorted()
        setSortedLinesWithReports(sortedLines)
    }, [ticketInspectorList])

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
            {currentTab === 'stations' && (
                <section className="list-modal">
                    {ticketInspectorList.map((ticketInspector) => (
                        <ReportItem
                            key={ticketInspector.station.id + ticketInspector.timestamp}
                            ticketInspector={ticketInspector}
                            currentTime={currentTime}
                        />
                    ))}
                </section>
            )}
            {currentTab === 'summary' && (
                <section className="summary">
                    <section>
                        <h2>Top 5 Linien</h2>
                        {Array.from(sortedLinesWithReports.entries())
                            .slice(0, 5)
                            .map(([line, inspectors]) => (
                                <ClusteredReportItem key={line} inspectors={inspectors} />
                            ))}
                    </section>
                    <section>
                        <h2>Risiko</h2>
                    </section>
                </section>
            )}
        </div>
    )
}

export default ReportsModal
