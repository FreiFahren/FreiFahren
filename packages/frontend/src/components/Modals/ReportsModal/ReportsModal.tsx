import './ReportsModal.css'

import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTicketInspectors } from 'src/contexts/TicketInspectorsContext'
import { Report } from 'src/utils/types'
import { FeedbackForm } from '../../Form/FeedbackForm/FeedbackForm'
import { LinesSection } from './LinesSection'
import { StationsSection } from './StationsSection'
import { SummarySection } from './SummarySection'

interface ReportsModalProps {
    className?: string
    onCloseModal: () => void
}

type TabType = 'summary' | 'lines' | 'stations'

const ReportsModal: React.FC<ReportsModalProps> = ({ className, onCloseModal }) => {
    const { t } = useTranslation()
    const [currentTab, setCurrentTab] = useState<TabType>('summary')
    const [showFeedback, setShowFeedback] = useState(false)
    const [ticketInspectorList, setTicketInspectorList] = useState<Report[]>([])
    const { getLast24HourReports } = useTicketInspectors()

    const currentTime = useMemo(() => new Date().getTime(), [])

    useEffect(() => {
        getLast24HourReports().then(setTicketInspectorList)
    }, [getLast24HourReports])

    const tabs: TabType[] = ['summary', 'lines', 'stations']

    const handleTabChange = (tab: TabType) => {
        setCurrentTab(tab)
    }

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
            {currentTab === 'lines' ? <LinesSection getChartData={getChartData} /> : null}
            {currentTab === 'stations' ? (
                <StationsSection ticketInspectorList={ticketInspectorList} currentTime={currentTime} />
            ) : null}
        </div>
    )
}

export { ReportsModal }
