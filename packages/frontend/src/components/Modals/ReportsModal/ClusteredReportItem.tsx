import './ReportsModal.css'

import { useState } from 'react'
import { MarkerData } from 'src/utils/types'

import { ReportItem } from './ReportItem'

interface ClusteredReportItemProps {
    inspectors: MarkerData[]
}

export const ClusteredReportItem = ({ inspectors }: ClusteredReportItemProps) => {
    const [isListExpanded, setIsListExpanded] = useState(false)

    const currentTime = new Date().getTime()

    // remove the direction from all of the inspectors to make it concise
    const inspectorsWithoutDirection = inspectors.map((inspector) => ({
        ...inspector,
        direction: { id: '', name: '', coordinates: { latitude: 0, longitude: 0 } },
    }))

    const expandedListWithoutTitle = inspectorsWithoutDirection.slice(1)

    return (
        <>
            <div className="clustered-report-item align-child-on-line">
                <div className="title-report-item">
                    <ReportItem ticketInspector={inspectorsWithoutDirection[0]} currentTime={currentTime} />
                </div>
                {inspectorsWithoutDirection.length > 1 && (
                    // eslint-disable-next-line jsx-a11y/control-has-associated-label, react/button-has-type
                    <button
                        className={isListExpanded ? 'expanded' : ''}
                        onClick={() => setIsListExpanded(!isListExpanded)}
                    />
                )}
            </div>
            <div className={`clustered-report-item-list list-modal ${isListExpanded ? 'expanded' : ''}`}>
                {isListExpanded &&
                    expandedListWithoutTitle.map((inspector) => (
                        <ReportItem
                            key={inspector.station.id + inspector.timestamp}
                            ticketInspector={inspector}
                            currentTime={currentTime}
                        />
                    ))}
            </div>
        </>
    )
}
