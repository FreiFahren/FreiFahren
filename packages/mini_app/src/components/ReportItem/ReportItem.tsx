import React from 'react'
import { Report } from '../../utils/types'
import { getLineColor } from '../../utils/getLineColor'
import './ReportItem.css'

interface ReportItemProps {
    report: Report
}

export const ReportItem: React.FC<ReportItemProps> = ({ report }) => {
    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp)
        return date.toLocaleTimeString('de-DE', { 
            hour: '2-digit', 
            minute: '2-digit' 
        })
    }

    return (
        <div className="report-item">
            <div className="report-item-header">
                <div className="report-item-time">
                    {formatTime(report.timestamp)}
                </div>
                {report.line && (
                    <div 
                        className="report-item-line"
                        style={{ backgroundColor: getLineColor(report.line) }}
                    >
                        {report.line}
                    </div>
                )}
            </div>
            <div className="report-item-station">
                {report.station.name}
            </div>
            {report.direction && (
                <div className="report-item-direction">
                    → {report.direction.name}
                </div>
            )}
            {report.message && (
                <div className="report-item-message">
                    {report.message}
                </div>
            )}
        </div>
    )
} 