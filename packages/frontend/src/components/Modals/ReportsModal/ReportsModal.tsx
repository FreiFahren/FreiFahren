import './ReportsModal.css'

import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useReports } from 'src/contexts/ReportsContext'
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
    const [reportsList, setReportsList] = useState<Report[]>([])
    const { getLast24HourReports } = useReports()

    const currentTime = useMemo(() => new Date().getTime(), [])

    useEffect(() => {
        getLast24HourReports().then(setReportsList)
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
            for (const report of reportsList) {
                const { line } = report

                if (line === null) continue
                lineReports.set(line, [...(lineReports.get(line) ?? []), report])
            }

            return new Map(Array.from(lineReports.entries()).sort((a, b) => b[1].length - a[1].length))
        }

        const sortedLines = getAllLinesWithReportsSorted()

        setSortedLinesWithReports(sortedLines)
    }, [reportsList])

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
            {currentTab === 'stations' ? <StationsSection reportsList={reportsList} currentTime={currentTime} /> : null}
        </div>
    )
}

export { ReportsModal }
