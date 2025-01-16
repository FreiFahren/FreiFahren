import React from 'react'
import { useTranslation } from 'react-i18next'
import { Report } from 'src/utils/types'

import { ReportItem } from './ReportItem'

interface StationsSectionProps {
    reportsList: Report[]
    currentTime: number
}

const StationsSection: React.FC<StationsSectionProps> = ({ reportsList, currentTime }) => {
    const { t } = useTranslation()

    return (
        <section className="list-modal">
            <h2>{t('ReportsModal.topStations')}</h2>
            <p className="time-range">{t('ReportsModal.past24Hours')}</p>
            {reportsList.map((report) => (
                <ReportItem key={report.station.id + report.timestamp} report={report} currentTime={currentTime} />
            ))}
        </section>
    )
}

export { StationsSection }
