import React from 'react'
import { useTranslation } from 'react-i18next'
import FeedbackButton from 'src/components/Buttons/FeedbackButton/FeedbackButton'
import { Line } from '../../Miscellaneous/Line/Line'
import { ClusteredReportItem } from './ClusteredReportItem'
import { Report } from 'src/utils/types'

interface SummarySectionProps {
    sortedLinesWithReports: Map<string, Report[]>
    riskLines: Map<string, LineRiskData>
    onCloseModal: () => void
    setShowFeedback: (show: boolean) => void
}

interface LineRiskData {
    score: number
    class: number
}

const SummarySection: React.FC<SummarySectionProps> = ({
    sortedLinesWithReports,
    riskLines,
    onCloseModal,
    setShowFeedback,
}) => {
    const { t } = useTranslation()
    const riskLevels = [3, 2, 1, 0]

    const filterRiskLevelLines = (level: number, riskData: LineRiskData): boolean => riskData.class === level

    return (
        <section className="summary">
            <section className="lines">
                <div className="align-child-on-line">
                    <h2>{t('ReportsModal.reportsHeading')}</h2>
                    <FeedbackButton handleButtonClick={() => setShowFeedback(true)} />
                </div>
                <p className="time-range">{t('ReportsModal.past24Hours')}</p>
                {Array.from(sortedLinesWithReports.entries())
                    .sort(([, inspectorsA], [, inspectorsB]) => {
                        const timestampA = new Date(inspectorsA[0].timestamp).getTime()
                        const timestampB = new Date(inspectorsB[0].timestamp).getTime()
                        return timestampB - timestampA
                    })
                    .slice(0, 5)
                    .map(([line, inspectors]) => (
                        <ClusteredReportItem key={line} inspectors={inspectors} />
                    ))}
            </section>
            <section className="risk">
                <h2>{t('ReportsModal.risk')}</h2>
                <div className="risk-grid">
                    {riskLevels.map((level) => {
                        const linesWithRiskLevel = Array.from(riskLines.entries()).filter(([, riskData]) =>
                            filterRiskLevelLines(level, riskData)
                        )

                        if (linesWithRiskLevel.length === 0) return null

                        return (
                            <div key={level} className="risk-grid-item">
                                {linesWithRiskLevel.map(([line, riskData]) => (
                                    <div
                                        key={line}
                                        className={`risk-line risk-level-${riskData.class}`}
                                        onClick={() => onCloseModal()}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        <img src={`/icons/risk-${riskData.class}.svg`} alt="Icon to show risk level" />
                                        <Line line={line} />
                                    </div>
                                ))}
                            </div>
                        )
                    })}
                </div>
            </section>
        </section>
    )
}

export { SummarySection }
