import { useState, useEffect } from 'react'
import { MarkerData } from 'src/utils/types'

const STORAGE_KEY = 'lastReportView'

interface LastViewState {
    timestamp: string
    lastViewedReportId?: string
}

// Create a custom event for report views
const REPORT_VIEW_EVENT = 'reportViewed'
const reportViewEvent = new EventTarget()

export const useLastReportView = () => {
    const [lastViewState, setLastViewState] = useState<LastViewState>(() => {
        const stored = localStorage.getItem(STORAGE_KEY)
        return stored ? JSON.parse(stored) : { timestamp: '' }
    })

    useEffect(() => {
        const handleReportView = (event: Event) => {
            const report = (event as CustomEvent<MarkerData | undefined>).detail
            const newState: LastViewState = {
                timestamp: new Date().toISOString(),
                lastViewedReportId: report ? `${report.station.id}-${report.timestamp}` : undefined,
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
            setLastViewState(newState)
        }

        reportViewEvent.addEventListener(REPORT_VIEW_EVENT, handleReportView)
        return () => reportViewEvent.removeEventListener(REPORT_VIEW_EVENT, handleReportView)
    }, [])

    const setLastViewed = (report?: MarkerData) => {
        reportViewEvent.dispatchEvent(new CustomEvent(REPORT_VIEW_EVENT, { detail: report }))
    }

    const hasViewedReport = (report: MarkerData): boolean => {
        if (!report) return false
        const reportId = `${report.station.id}-${report.timestamp}`
        return (
            lastViewState.lastViewedReportId === reportId ||
            new Date(report.timestamp).getTime() <= new Date(lastViewState.timestamp).getTime()
        )
    }

    return {
        lastViewedTimestamp: lastViewState.timestamp,
        setLastViewed,
        hasViewedReport,
    }
}
