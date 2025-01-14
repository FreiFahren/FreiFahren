import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Report } from 'src/utils/types'

import { useRiskData } from './RiskDataContext'
import { useApi } from 'src/hooks/useApi'

interface ReportsContextProps {
    currentReports: Report[]
    getReports: () => void
    getLast24HourReports: () => Promise<Report[]>
}

const ReportsContext = createContext<ReportsContextProps | undefined>(undefined)

export const useReports = () => {
    const context = useContext(ReportsContext)

    if (!context) {
        throw new Error('useReports must be used within a useReportsProvider')
    }
    return context
}
export const ReportsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentReports, setCurrentReports] = useState<Report[]>([])
    const [previousDayReports, setPreviousDayReports] = useState<Report[]>([])
    const lastReceivedreportTime = useRef<Date | null>(null)
    const lastFetchedPreviousDayTime = useRef<Date | null>(null)
    const riskData = useRiskData()
    const { get, getWithIfModifiedSince, isLoading, error } = useApi()

    const getReports = useCallback(async () => {
        const endTime = new Date().toISOString()
        const startTime = new Date(new Date(endTime).getTime() - 60 * 60 * 1000).toISOString()

        const response = await getWithIfModifiedSince<Report[]>(
            `/basics/inspectors?start=${startTime}&end=${endTime}`,
            lastReceivedreportTime.current
        )

        if (response.success && response.data && response.data.length > 0) {
            const data = response.data
            setCurrentReports((currentList) => {
                // Create a map to track the most recent entry per station Id
                const updatedList = new Map(currentList.map((report) => [report.station.id, report]))

                data.forEach((newreport: Report) => {
                    const existingreport = updatedList.get(newreport.station.id)

                    if (existingreport) {
                        // Compare timestamps and wether it is historic to decide if we need to update
                        if (
                            new Date(newreport.timestamp) >= new Date(existingreport.timestamp) &&
                            newreport.isHistoric === false
                        ) {
                            updatedList.set(newreport.station.id, newreport)
                        }
                    } else {
                        // If no existing report with the same Id, add the new one
                        updatedList.set(newreport.station.id, newreport)
                    }
                })

                // Set the latest timestamp as if-modified-since header for the next request
                const latestTimestamp = Math.max(...data.map((report: Report) => new Date(report.timestamp).getTime()))
                lastReceivedreportTime.current = new Date(latestTimestamp)

                // new report means new risk data
                riskData.refreshRiskData().catch((error) => {
                    // fix this later with sentry
                    // eslint-disable-next-line no-console
                    console.error('Error refreshing risk data:', error)
                })

                return Array.from(updatedList.values())
            })
        }
    }, [riskData, getWithIfModifiedSince])

    const getLast24HourReports = useCallback(async (): Promise<Report[]> => {
        const currentTime = new Date().getTime()

        // Check if we need to fetch previous day data (cache for 5 minutes) will also avoid infinite loop
        const shouldFetchPreviousDay =
            !lastFetchedPreviousDayTime.current ||
            currentTime - lastFetchedPreviousDayTime.current.getTime() > 5 * 60 * 1000

        // If we're loading or have an error, just return the current hour's data
        if (isLoading || error) {
            return currentReports
        }

        if (shouldFetchPreviousDay) {
            const startTimeInRFC3339 = new Date(currentTime - 1000 * 60 * 60 * 24).toISOString()
            const endTimeInRFC3339 = new Date(currentTime - 1000 * 60 * 60).toISOString()

            const response = await get<Report[]>(
                `/basics/inspectors?start=${startTimeInRFC3339}&end=${endTimeInRFC3339}`
            )

            if (response.success && response.data) {
                // Filter out historic reports from previous day
                const filteredPreviousDayreportList = response.data.filter((report: Report) => !report.isHistoric)

                setPreviousDayReports(filteredPreviousDayreportList)
                lastFetchedPreviousDayTime.current = new Date()
            }
        }

        // Separate historic and recent reports from the last hour
        const historicReports = currentReports.filter((report) => report.isHistoric)
        const recentReports = currentReports.filter((report) => !report.isHistoric)

        const sortByTimestamp = (a: Report, b: Report): number =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()

        // Combine and sort all lists
        const sortedLists = [recentReports, historicReports, previousDayReports].map((list) =>
            list.sort(sortByTimestamp)
        )

        return sortedLists.flat()
    }, [currentReports, previousDayReports, get, error, isLoading])

    useEffect(() => {
        getReports().catch((error) => {
            // fix this later with sentry
            // eslint-disable-next-line no-console
            console.error('Error refreshing reports data:', error)
        })
        const interval = setInterval(getReports, 5 * 1000)

        return () => clearInterval(interval)
    }, [getReports])

    const value = useMemo(
        () => ({ currentReports, getReports, getLast24HourReports }),
        [currentReports, getReports, getLast24HourReports]
    )

    return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>
}
