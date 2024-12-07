import React, { createContext, useContext, useCallback, useMemo, useEffect } from 'react'
import { Report } from 'src/utils/types'

const STORAGE_KEY = 'viewedReports'
const MAX_AGE_MS = 60 * 60 * 1000 // 60 minutes in milliseconds

interface ViewedReport {
    id: string
    timestamp: string
}

interface ViewedReportsContextType {
    readonly viewedReports: ViewedReport[]
    readonly setLastViewed: (report: Report) => void
    readonly hasViewedReport: (report: Report) => boolean
    readonly isRecentAndUnviewed: (report: Report) => boolean
}

const createReportId = (report: Report): string => `${report.station.id}-${report.timestamp}` // in order to avoid duplicates with same station

const isReportExpired = (report: ViewedReport): boolean => {
    const currentTime = new Date().getTime()
    const reportTime = new Date(report.timestamp).getTime()
    return currentTime - reportTime >= MAX_AGE_MS
}

const isReportRecent = (report: Report): boolean => {
    const currentTime = new Date().getTime()
    const reportTime = new Date(report.timestamp).getTime()
    return currentTime - reportTime <= 30 * 60 * 1000 // 30 minutes
}

const loadInitialReports = (): ViewedReport[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        const reports = stored ? JSON.parse(stored) : []
        return reports.filter((report: ViewedReport) => !isReportExpired(report))
    } catch {
        return []
    }
}

const ViewedReportsContext = createContext<ViewedReportsContextType | null>(null)

export const ViewedReportsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [reports, setReports] = React.useState<ViewedReport[]>(loadInitialReports)

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
    }, [reports])

    // Cleanup expired reports periodically
    useEffect(() => {
        const cleanup = () => {
            setReports((prev) => prev.filter((report) => !isReportExpired(report)))
        }

        const interval = setInterval(cleanup, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    const setLastViewed = useCallback((report: Report) => {
        const newReport: ViewedReport = {
            id: createReportId(report),
            timestamp: new Date().toISOString(),
        }

        setReports((prev) => {
            const filtered = prev.filter((r) => r.id !== newReport.id)
            return [newReport, ...filtered]
        })
    }, [])

    const hasViewedReport = useCallback(
        (report: Report): boolean => {
            if (!report) return false
            const reportId = createReportId(report)
            return reports.some((r) => r.id === reportId)
        },
        [reports]
    )

    const isRecentAndUnviewed = useCallback(
        (report: Report): boolean => {
            if (!report) return false
            return isReportRecent(report) && !hasViewedReport(report)
        },
        [hasViewedReport]
    )

    const contextValue = useMemo(
        () => ({
            viewedReports: reports,
            setLastViewed,
            hasViewedReport,
            isRecentAndUnviewed,
        }),
        [reports, setLastViewed, hasViewedReport, isRecentAndUnviewed]
    )

    return <ViewedReportsContext.Provider value={contextValue}>{children}</ViewedReportsContext.Provider>
}

// custom hook to use the context
export const useViewedReports = (): ViewedReportsContextType => {
    const context = useContext(ViewedReportsContext)
    if (!context) {
        throw new Error('useViewedReports must be used within a ViewedReportsProvider')
    }
    return context
}
