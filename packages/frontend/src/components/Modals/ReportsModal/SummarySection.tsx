import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FeedbackButton from 'src/components/Buttons/FeedbackButton/FeedbackButton'
import { useRiskData } from 'src/contexts/RiskDataContext'
import { useStationsAndLines } from 'src/contexts/StationsAndLinesContext'
import { Report } from 'src/utils/types'

import { Line } from '../../Miscellaneous/Line/Line'
import { ClusteredReportItem } from './ClusteredReportItem'

interface SummarySectionProps {
    sortedLinesWithReports: Map<string, Report[]>
    onCloseModal: () => void
    setShowFeedback: (show: boolean) => void
}

interface LineRiskData {
    score: number
    class: number
}

const SummarySection: React.FC<SummarySectionProps> = ({ sortedLinesWithReports, onCloseModal, setShowFeedback }) => {
    const { t } = useTranslation()
    const riskLevels = [3, 2, 1, 0]
    const { segmentRiskData } = useRiskData()
    const { allLines } = useStationsAndLines()
    const [riskLines, setRiskLines] = useState<Map<string, LineRiskData>>(new Map())

    useEffect(() => {
        if (segmentRiskData) {
            const extractMostRiskLines = (segmentColors: Record<string, string>): Map<string, LineRiskData> => {
                const colorScores: Record<string, number> = {
                    '#A92725': 3, // bad - red
                    '#F05044': 3, // also bad - red (otherwise we would have too many colors, therfore aggregate)
                    '#FACB3F': 1, // okay - yellow
                }

                const lineScores = new Map<string, LineRiskData>()

                Object.entries(segmentColors).forEach(([segmentId, color]) => {
                    // eslint-disable-next-line prefer-destructuring
                    const line = segmentId.split('-')[0]
                    const score = color in colorScores ? colorScores[color] : 0

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

                // Sort first by class (highest to lowest), then by score within each class
                return new Map(
                    Array.from(lineScores.entries()).sort(([, a], [, b]) => {
                        if (b.class !== a.class) {
                            return b.class - a.class
                        }
                        return b.score - a.score
                    })
                )
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
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault()
                                                onCloseModal()
                                            }
                                        }}
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
