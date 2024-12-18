import './ReportsModal.css'

import React, { useState } from 'react'
import { Report } from 'src/utils/types'

import { ReportItem } from './ReportItem'

interface ClusteredReportItemProps {
    inspectors: Report[]
}

const ClusteredReportItem: React.FC<ClusteredReportItemProps> = ({ inspectors }) => {
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
                    <ReportItem report={inspectorsWithoutDirection[0]} currentTime={currentTime} />
                </div>
                {inspectorsWithoutDirection.length > 1 ? <button
                        type="button"
                        aria-label="Toggle report list"
                        className={isListExpanded ? 'expanded' : ''}
                        onClick={() => setIsListExpanded(!isListExpanded)}
                    /> : null}
            </div>
            <div className={`clustered-report-item-list list-modal ${isListExpanded ? 'expanded' : ''}`}>
                {isListExpanded ? expandedListWithoutTitle.map((inspector) => (
                        <ReportItem
                            key={inspector.station.id + inspector.timestamp}
                            report={inspector}
                            currentTime={currentTime}
                        />
                    )) : null}
            </div>
        </>
    )
}

export { ClusteredReportItem }
