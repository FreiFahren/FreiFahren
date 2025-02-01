import './ReportsModal.css'

import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLast24HourReports } from 'src/api/queries'
import { Report } from 'src/utils/types'

import { FeedbackForm } from '../../Form/FeedbackForm/FeedbackForm'
import { LinesSection } from './LinesSection'
import { StationsSection } from './StationsSection'
import { SummarySection } from './SummarySection'

interface ReportsModalProps {
    className?: string
    handleCloseModal: () => void
}

type TabType = 'summary' | 'lines' | 'stations'

const ReportsModal: React.FC<ReportsModalProps> = ({ className, handleCloseModal }) => {
    const { t } = useTranslation()
    const [currentTab, setCurrentTab] = useState<TabType>('summary')
    const [showFeedback, setShowFeedback] = useState(false)
    const { data: last24HourReports } = useLast24HourReports()

    const currentTime = useMemo(() => new Date().getTime(), [])
    const tabs: TabType[] = ['summary', 'lines', 'stations']
    const [sortedLinesWithReports, setSortedLinesWithReports] = useState<Map<string, Report[]>>(new Map())

    const groupReportsByLine = (reports: Report[]): Map<string, Report[]> => {
        const lineReports = new Map<string, Report[]>()

        for (const report of reports) {
            const { line } = report
            if (line === null) continue

            const existingReports = lineReports.get(line) ?? []
            lineReports.set(line, [...existingReports, report])
        }

        return lineReports
    }

    // Sort lines by number of reports (descending)
    const sortLinesByReportCount = (lineReports: Map<string, Report[]>): Map<string, Report[]> => {
        const sortedEntries = Array.from(lineReports.entries()).sort((a, b) => b[1].length - a[1].length)
        return new Map(sortedEntries)
    }

    // Check if the new sorted lines are different from current state
    const hasLinesSortingChanged = (current: Map<string, Report[]>, next: Map<string, Report[]>): boolean => {
        const currentEntries = Array.from(current.entries())
        const nextEntries = Array.from(next.entries())

        if (currentEntries.length !== nextEntries.length) return true

        return currentEntries.some(
            (entry, index) => entry[0] !== nextEntries[index][0] || entry[1].length !== nextEntries[index][1].length
        )
    }

    useEffect(() => {
        const groupedReports = groupReportsByLine(last24HourReports)
        const sortedLines = sortLinesByReportCount(groupedReports)

        if (hasLinesSortingChanged(sortedLinesWithReports, sortedLines)) {
            setSortedLinesWithReports(sortedLines)
        }
    }, [last24HourReports, sortedLinesWithReports])

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

    const handleTabChange = (tab: TabType) => {
        setCurrentTab(tab)
    }

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
                    onCloseModal={handleCloseModal}
                    setShowFeedback={setShowFeedback}
                />
            ) : null}
            {currentTab === 'lines' ? <LinesSection getChartData={getChartData} /> : null}
            {currentTab === 'stations' ? (
                <StationsSection reportsList={last24HourReports} currentTime={currentTime} />
            ) : null}
        </div>
    )
}

export { ReportsModal }
