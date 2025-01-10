import './ReportsModal.css'

import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, ResponsiveContainer, Tooltip, TooltipProps, XAxis, YAxis } from 'recharts'
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import FeedbackButton from 'src/components/Buttons/FeedbackButton/FeedbackButton'
import { useTicketInspectors } from 'src/contexts/TicketInspectorsContext'
import { getRecentDataWithIfModifiedSince } from 'src/utils/databaseUtils'
import { Report } from 'src/utils/types'
import { getLineColor } from 'src/utils/uiUtils'

import { FeedbackForm } from '../../Form/FeedbackForm/FeedbackForm'
import { ReportItem } from './ReportItem'
import { SummarySection } from './SummarySection'

interface ReportsModalProps {
    className?: string
    onCloseModal: () => void
}

type TabType = 'summary' | 'lines' | 'stations'

interface CustomTooltipProps extends TooltipProps<ValueType, NameType> {
    getChartData: { line: string; reports: number }[]
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, getChartData }) => {
    const { t } = useTranslation()

    if (!(active ?? false) || !payload || payload.length === 0) return null

    const data = payload[0].payload
    const totalReports = getChartData.reduce((sum, item) => sum + item.reports, 0)
    const percentage = ((data.reports / totalReports) * 100).toFixed(1)

    return (
        <div
            className="custom-tooltip"
            style={{
                backgroundColor: '#000',
                color: '#fff',
                padding: '8px',
                borderRadius: '4px',
            }}
        >
            <h4>{`${percentage}% ${t('ReportsModal.ofTotal')}`}</h4>
            <p>{`${data.reports} ${t('ReportsModal.reports')}`}</p>
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomBarShape = ({ x, y, width, height, payload }: any) => {
    const color = getLineColor(payload.line)

    return <rect x={x} y={y} width={width} height={height} fill={color} rx={4} ry={4} />
}

const ReportsModal: React.FC<ReportsModalProps> = ({ className, onCloseModal }) => {
    const { t } = useTranslation()
    const [currentTab, setCurrentTab] = useState<TabType>('summary')
    const [showFeedback, setShowFeedback] = useState(false)

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
                ((await getRecentDataWithIfModifiedSince(
                    `${process.env.REACT_APP_API_URL}/basics/inspectors?start=${startTimeInRFC3339}&end=${endTimeInRFC3339}`,
                    null // no caching to make it less error prone
                )) as Report[] | null) ?? [] // in case the server returns, 304 Not Modified

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

                if (line === null) continue
                lineReports.set(line, [...(lineReports.get(line) ?? []), inspector])
            }

            return new Map(Array.from(lineReports.entries()).sort((a, b) => b[1].length - a[1].length))
        }

        const sortedLines = getAllLinesWithReportsSorted()

        setSortedLinesWithReports(sortedLines)
    }, [ticketInspectorList])

    const getChartData = useMemo(
        () =>
            Array.from(sortedLinesWithReports.entries())
                .filter(([line]) => line !== '')
                .map(([line, reports]) => ({
                    line,
                    reports: reports.length,
                })),
        [sortedLinesWithReports]
    )

    if (showFeedback) {
        return <FeedbackForm openAnimationClass={className} />
    }

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
            {currentTab === 'summary' ? (
                <SummarySection
                    sortedLinesWithReports={sortedLinesWithReports}
                    onCloseModal={onCloseModal}
                    setShowFeedback={setShowFeedback}
                />
            ) : null}
            {currentTab === 'lines' ? (
                <section className="list-modal">
                    <h2>{t('ReportsModal.topLines')}</h2>
                    <p className="time-range">{t('ReportsModal.past24Hours')}</p>
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
                                    fill: '#fff',
                                    dx: -5,
                                }}
                            />
                            <Tooltip content={<CustomTooltip getChartData={getChartData} />} />
                            <Bar
                                dataKey="reports"
                                barSize={24}
                                radius={[4, 4, 4, 4]}
                                fill="#7e5330"
                                name="reports"
                                shape={CustomBarShape}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </section>
            ) : null}
            {currentTab === 'stations' ? (
                <section className="list-modal">
                    <h2>{t('ReportsModal.topStations')}</h2>
                    <p className="time-range">{t('ReportsModal.past24Hours')}</p>
                    {ticketInspectorList.map((ticketInspector) => (
                        <ReportItem
                            key={ticketInspector.station.id + ticketInspector.timestamp}
                            report={ticketInspector}
                            currentTime={currentTime}
                        />
                    ))}
                </section>
            ) : null}
        </div>
    )
}

export { ReportsModal }
