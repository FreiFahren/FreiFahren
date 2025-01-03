import './ReportsModal.css'

import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, ResponsiveContainer, Tooltip, TooltipProps,XAxis, YAxis } from 'recharts'
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { useRiskData } from 'src/contexts/RiskDataContext'
import { useStationsAndLines } from 'src/contexts/StationsAndLinesContext'
import { useTicketInspectors } from 'src/contexts/TicketInspectorsContext'
import { getRecentDataWithIfModifiedSince } from 'src/utils/databaseUtils'
import { Report } from 'src/utils/types'
import { getLineColor } from 'src/utils/uiUtils'

import { Line } from '../../Miscellaneous/Line/Line'
import { ClusteredReportItem } from './ClusteredReportItem'
import { ReportItem } from './ReportItem'

interface ReportsModalProps {
    className?: string
    onCloseModal: () => void
}

type TabType = 'summary' | 'lines' | 'stations'

interface CustomTooltipProps extends TooltipProps<ValueType, NameType> {
    getChartData: { line: string; reports: number }[]
    isLightTheme: boolean
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, getChartData, isLightTheme }) => {
    const { t } = useTranslation()

    if (!(active ?? false) || !payload || (payload.length === 0)) return null

    const data = payload[0].payload
    const totalReports = getChartData.reduce((sum, item) => sum + item.reports, 0)
    const percentage = ((data.reports / totalReports) * 100).toFixed(1)

    return (
        <div
            className="custom-tooltip"
            style={{
                backgroundColor: isLightTheme === true ? '#fff' : '#000',
                color: isLightTheme === true ? '#000' : '#fff',
                padding: '8px',
                borderRadius: '4px',
            }}
        >
            <h4>{`${percentage}% ${t('ReportsModal.ofTotal')}`}</h4>
            <p>{`${data.reports} ${t('ReportsModal.reports')}`}</p>
        </div>
    )
}
// PLEASE REFACTOR THIS LATER OR MOVE IT OUT, THE REPORTS MODAL COMPONENT IS A FUCKING MESS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomBarShape = ({ x, y, width, height, payload }: any) => {
    const color = getLineColor(payload.line)

    return <rect x={x} y={y} width={width} height={height} fill={color} rx={4} ry={4} />
}

const ReportsModal: React.FC<ReportsModalProps> = ({ className, onCloseModal }) => {
    const { t } = useTranslation()
    const [currentTab, setCurrentTab] = useState<TabType>('summary')

    const tabs: TabType[] = ['summary', 'lines', 'stations']

    const handleTabChange = (tab: TabType) => {
        setCurrentTab(tab)
    }

    const [ticketInspectorList, setTicketInspectorList] = useState<Report[]>([])
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
                ) as Report[] | null) ?? [] // in case the server returns, 304 Not Modified

            // Separate historic inspectors from lastHourInspectorList
            const historicInspectors = lastHourInspectorList.filter((inspector) => inspector.isHistoric)
            const recentInspectors = lastHourInspectorList.filter((inspector) => !inspector.isHistoric)

            // remove historic inspectors from previousDayInspectorList
            const filteredPreviousDayInspectorList = previousDayInspectorList.filter(
                (inspector: Report) => !inspector.isHistoric
            )

            const sortByTimestamp = (a: Report, b: Report): number =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()

            const sortedLists = [recentInspectors, historicInspectors, filteredPreviousDayInspectorList].map((list) =>
                list.sort(sortByTimestamp)
            )

            setTicketInspectorList(sortedLists.flat())
        }

        fetchInspectorList().catch((error) => {
            // fix later with sentry
            // eslint-disable-next-line no-console
            console.error('Error fetching inspector list:', error)
        })
    }, [currentTime, lastHourInspectorList])

    const [sortedLinesWithReports, setSortedLinesWithReports] = useState<Map<string, Report[]>>(new Map())

    useEffect(() => {
        const getAllLinesWithReportsSorted = (): Map<string, Report[]> => {
            const lineReports = new Map<string, Report[]>()

            // Group reports by line
            for (const inspector of ticketInspectorList) {
                const { line } = inspector

                if (line === null ) continue
                lineReports.set(line, [...(lineReports.get(line) ?? []), inspector])
            }

            return new Map(Array.from(lineReports.entries()).sort((a, b) => b[1].length - a[1].length))
        }

        const sortedLines = getAllLinesWithReportsSorted()

        setSortedLinesWithReports(sortedLines)
    }, [ticketInspectorList])

    const { segmentRiskData } = useRiskData()
    const { allLines } = useStationsAndLines()
    const [riskLines, setRiskLines] = useState<Map<string, LineRiskData>>(new Map())

    interface LineRiskData {
        score: number
        class: number
    }

    useEffect(() => {
        if (segmentRiskData) {
            const extractMostRiskLines = (segmentColors: Record<string, string>): Map<string, LineRiskData> => {
                const colorScores: Record<string, number> = {
                    '#A92725': 3, // bad
                    '#F05044': 2, // medium
                    '#FACB3F': 1, // okay
                }

            const lineScores = new Map<string, LineRiskData>()

                Object.entries(segmentColors).forEach(([segmentId, color]) => {
                    // eslint-disable-next-line prefer-destructuring
                    const line = segmentId.split('-')[0]
                    const score = colorScores[color]

                    if (!lineScores.has(line)) {
                        lineScores.set(line, { score, class: score })
                    } else {
                        const currentData = lineScores.get(line)!

                        lineScores.set(line, {
                            score: currentData.score + score,
                            class: Math.max(currentData.class, score),
                        })
                    }
                })

            return new Map(Array.from(lineScores.entries()).sort(([, a], [, b]) => b.score - a.score))
        }

            const riskMap = extractMostRiskLines(segmentRiskData.segment_colors)

            Object.keys(allLines).forEach((line) => {
                if (!riskMap.has(line)) {
                    riskMap.set(line, { score: 0, class: 0 })
                }
            })
            setRiskLines(riskMap)
        }
    }, [segmentRiskData, allLines])

    const getChartData = useMemo(() => Array.from(sortedLinesWithReports.entries())
        .filter(([line]) => line !== '')
        .map(([line, reports]) => ({
            line,
            reports: reports.length,
        })), [sortedLinesWithReports])


    const [isLightTheme, setIsLightTheme] = useState<boolean>(false)

    useEffect(() => {
        const theme = localStorage.getItem('colorTheme')

        setIsLightTheme(theme === 'light')

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === 'theme') {
                setIsLightTheme(event.newValue === 'dark')
            }
        }

        window.addEventListener('storage', handleStorageChange)
        return () => window.removeEventListener('storage', handleStorageChange)
    }, [])

    return (
        <div className={`reports-modal modal container ${className}`}>
            <section className="tabs align-child-on-line">
                {tabs.map((tab) => (
                    <button
                        type="button"
                        key={tab}
                        onClick={() => handleTabChange(tab)}
                        className={currentTab === tab ? 'active' : ''}
                    >
                        <h3>{t(`ReportsModal.${tab}`)}</h3>
                    </button>
                ))}
            </section>
            {currentTab === 'summary' ? <section className="summary">
                    <section className="lines">
                        <h2>{t('ReportsModal.reportsHeading')}</h2>
                        <p>{t('ReportsModal.past24Hours')}</p>
                        {Array.from(sortedLinesWithReports.entries())
                            .sort(([, inspectorsA], [, inspectorsB]) => {
                                const timestampA = new Date(inspectorsA[0].timestamp).getTime()
                                const timestampB = new Date(inspectorsB[0].timestamp).getTime()

                                return timestampB - timestampA // most recent first
                            })
                            .slice(0, 5)
                            .map(([line, inspectors]) => (
                                <ClusteredReportItem key={line} inspectors={inspectors} />
                            ))}
                    </section>
                    <section className="risk">
                        <h2>{t('ReportsModal.risk')}</h2>
                        <div className="risk-grid">
                            {Array.from(riskLines.entries()).some(
                                ([, riskData]) => riskData.class === 2 || riskData.class === 3
                            ) ? <div className="risk-grid-item">
                                    {Array.from(riskLines.entries())
                                        .filter(([, riskData]) => riskData.class === 2 || riskData.class === 3)
                                        .map(([line, riskData]) => (
                                            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                                            <div
                                                key={line}
                                                className={`risk-line risk-level-${riskData.class}`}
                                                onClick={() => onCloseModal()}
                                            >
                                                <img
                                                    src={`/icons/risk-${riskData.class}.svg`}
                                                    alt="Icon to show risk level"
                                                />
                                                <Line line={line} />
                                            </div>
                                        ))}
                                </div> : null}
                            {Array.from(riskLines.entries()).some(([, riskData]) => riskData.class === 1) ? <div className="risk-grid-item">
                                    {Array.from(riskLines.entries())
                                        .filter(([, riskData]) => riskData.class === 1)
                                        .map(([line, riskData]) => (
                                            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                                            <div
                                                key={line}
                                                className={`risk-line risk-level-${riskData.class}`}
                                                onClick={() => onCloseModal()}
                                            >
                                                <img
                                                    src={`/icons/risk-${riskData.class}.svg`}
                                                    alt="Icon to show risk level"
                                                />
                                                <Line line={line} />
                                            </div>
                                        ))}
                                </div> : null}
                            {Array.from(riskLines.entries()).some(([, riskData]) => riskData.class === 0) ? <div className="risk-grid-item">
                                    {Array.from(riskLines.entries())
                                        .filter(([, riskData]) => riskData.class === 0)
                                        .map(([line, riskData]) => (
                                            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                                            <div
                                                key={line}
                                                className={`risk-line risk-level-${riskData.class}`}
                                                onClick={() => onCloseModal()}
                                            >
                                                <img
                                                    src={`/icons/risk-${riskData.class}.svg`}
                                                    alt="Icon to show risk level"
                                                />
                                                <Line line={line} />
                                            </div>
                                        ))}
                                </div> : null}
                        </div>
                    </section>
                </section> : null}
            {currentTab === 'lines' ? <section className="list-modal">
                    <h2>{t('ReportsModal.topLines')}</h2>
                    <p>{t('ReportsModal.past24Hours')}</p>
                    <ResponsiveContainer width="100%" height={getChartData.length * (34 + 12)}>
                        <BarChart data={getChartData} layout="vertical">
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="line"
                                width={40}
                                interval={0}
                                axisLine={false}
                                tickLine={false}
                                tick={{
                                    fontSize: 16,
                                    fontWeight: 800,
                                    fill: isLightTheme ? '#000' : '#fff',
                                    dx: -5,
                                }}
                            />
                            <Tooltip content={<CustomTooltip getChartData={getChartData} isLightTheme={isLightTheme} />} />
                            <Bar
                                dataKey="reports"
                                barSize={34}
                                radius={[4, 4, 4, 4]}
                                fill="#7e5330"
                                name="reports"
                                shape={CustomBarShape}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </section> : null}
            {currentTab === 'stations' ? <section className="list-modal">
                    <h2>{t('ReportsModal.topStations')}</h2>
                    <p>{t('ReportsModal.past24Hours')}</p>
                    {ticketInspectorList.map((ticketInspector) => (
                        <ReportItem
                            key={ticketInspector.station.id + ticketInspector.timestamp}
                            report={ticketInspector}
                            currentTime={currentTime}
                        />
                    ))}
                </section> : null}
        </div>
    )
}

export { ReportsModal }
