import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useTicketInspectors } from 'src/contexts/TicketInspectorsContext'
import { MarkerData } from 'src/utils/types'
import { getRecentDataWithIfModifiedSince } from 'src/utils/dbUtils'

import ReportItem from './ReportItem'
import ClusteredReportItem from './ClusteredReportItem'

import './ReportsModal.css'
import { useRiskData } from 'src/contexts/RiskDataContext'

interface ReportsModalProps {
    className?: string
    closeModal: () => void
}

type TabType = 'summary' | 'lines' | 'stations'

const ReportsModal: React.FC<ReportsModalProps> = ({ className, closeModal }) => {
    const { t } = useTranslation()
    const [currentTab, setCurrentTab] = useState<TabType>('summary')

    const tabs: TabType[] = ['summary', 'stations']

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
            const lineReports = new Map<string, MarkerData[]>()

            // Group reports by line
            for (const inspector of ticketInspectorList) {
                const { line } = inspector
                if (line === '') continue
                lineReports.set(line, [...(lineReports.get(line) || []), inspector])
            }

            // Sort lines by their latest report timestamp (first item in each array)
            return new Map(
                Array.from(lineReports.entries())
                    .sort((a, b) => {
                        const aTime = new Date(a[1][0].timestamp).getTime()
                        const bTime = new Date(b[1][0].timestamp).getTime()
                        return bTime - aTime
                    })
                    .map(([line, reports]) => [line, reports])
            )
        }

        const sortedLines = getAllLinesWithReportsSorted()
        setSortedLinesWithReports(sortedLines)
    }, [ticketInspectorList])

    const { segmentRiskData } = useRiskData()
    const [riskLines, setRiskLines] = useState<Map<string, number>>(new Map())

    const extractMostRiskLines = (segmentColors: Record<string, string>): Map<string, number> => {
        const colorScores: Record<string, number> = {
            '#A92725': 3, // bad
            '#F05044': 2, // medium
            '#FACB3F': 1, // okay
        }

        const lineScores = new Map<string, number>()
        Object.entries(segmentColors).forEach(([segmentId, color]) => {
            const line = segmentId.split('-')[0]
            const score = colorScores[color] || 0

            if (!lineScores.has(line) || score > lineScores.get(line)!) {
                lineScores.set(line, score)
            }
        })
        return new Map(Array.from(lineScores.entries()).sort((a, b) => b[1] - a[1]))
    }

    useEffect(() => {
        if (segmentRiskData && segmentRiskData.segment_colors) {
            const riskMap = extractMostRiskLines(segmentRiskData.segment_colors)
            Array.from(sortedLinesWithReports.entries()).forEach(([line]) => {
                if (!riskMap.has(line)) {
                    riskMap.set(line, 0)
                }
            })
            setRiskLines(riskMap)
        }
    }, [segmentRiskData, sortedLinesWithReports])

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
                    <section className="lines">
                        <h2>{t('ReportsModal.top5Lines')}</h2>
                        {Array.from(sortedLinesWithReports.entries())
                            .slice(0, 5)
                            .map(([line, inspectors]) => (
                                <ClusteredReportItem key={line} inspectors={inspectors} />
                            ))}
                    </section>
                    <section className="risk">
                        <h2>{t('ReportsModal.risk')}</h2>
                        <div className="risk-grid">
                            <div className="risk-grid-item">
                                {Array.from(riskLines.entries())
                                    .filter(([, level]) => level === 2 || level === 3)
                                    .map(([line, level]) => (
                                        <div
                                            key={line}
                                            className={`risk-line risk-level-${level}`}
                                            onClick={() => closeModal()}
                                        >
                                            <img src={`/icons/risk-${level}.svg`} alt="Icon to show risk level" />
                                            <h4 className={`line-label ${line}`}>{line}</h4>
                                        </div>
                                    ))}
                            </div>
                            <div className="risk-grid-item">
                                {Array.from(riskLines.entries())
                                    .filter(([, level]) => level === 1)
                                    .map(([line, level]) => (
                                        <div
                                            key={line}
                                            className={`risk-line risk-level-${level}`}
                                            onClick={() => closeModal()}
                                        >
                                            <img src={`/icons/risk-${level}.svg`} alt="Icon to show risk level" />
                                            <h4 className={`line-label ${line}`}>{line}</h4>
                                        </div>
                                    ))}
                            </div>
                            <div className="risk-grid-item">
                                {Array.from(riskLines.entries())
                                    .filter(([, level]) => level === 0)
                                    .map(([line, level]) => (
                                        <div
                                            key={line}
                                            className={`risk-line risk-level-${level}`}
                                            onClick={() => closeModal()}
                                        >
                                            <img src={`/icons/risk-${level}.svg`} alt="Icon to show risk level" />
                                            <h4 className={`line-label ${line}`}>{line}</h4>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </section>
                </section>
            )}
        </div>
    )
}

export default ReportsModal
