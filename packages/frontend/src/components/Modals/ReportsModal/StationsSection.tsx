import React from 'react'
import { useTranslation } from 'react-i18next'
import { Report } from 'src/utils/types'
import { ReportItem } from './ReportItem'

interface StationsSectionProps {
    ticketInspectorList: Report[]
    currentTime: number
}

const StationsSection: React.FC<StationsSectionProps> = ({ ticketInspectorList, currentTime }) => {
    const { t } = useTranslation()

    return (
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
    )
}

export { StationsSection }
