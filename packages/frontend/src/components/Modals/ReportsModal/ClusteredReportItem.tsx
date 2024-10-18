import React, { useState } from 'react'

import { MarkerData } from 'src/utils/types'

import ReportItem from './ReportItem'

import './ReportsModal.css'

interface ClusteredReportItemProps {
    inspectors: MarkerData[]
}

const ClusteredReportItem: React.FC<ClusteredReportItemProps> = ({ inspectors }) => {
    const [isListExpanded, setIsListExpanded] = useState(false)

    const currentTime = new Date().getTime()

    // clear direction to make it concise
    const titleInspector: MarkerData = {
        ...inspectors[0],
        direction: { id: '', name: '', coordinates: { latitude: 0, longitude: 0 } },
    }

    return (
        <div className="clustered-report-item align-child-on-line">
            <div className="title-report-item">
                <ReportItem ticketInspector={titleInspector} currentTime={currentTime} />
            </div>
            <button className={isListExpanded ? 'expanded' : ''} onClick={() => setIsListExpanded(!isListExpanded)} />
        </div>
    )
}

export default ClusteredReportItem
