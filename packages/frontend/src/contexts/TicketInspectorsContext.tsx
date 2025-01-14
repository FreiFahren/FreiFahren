import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Report } from 'src/utils/types'

import { useRiskData } from './RiskDataContext'
import { useApi } from 'src/hooks/useApi'

interface TicketInspectorsContextProps {
    ticketInspectorList: Report[]
    refreshInspectorsData: () => void
    getLast24HourReports: () => Promise<Report[]>
}

const TicketInspectorsContext = createContext<TicketInspectorsContextProps | undefined>(undefined)

export const useTicketInspectors = () => {
    const context = useContext(TicketInspectorsContext)

    if (!context) {
        throw new Error('useTicketInspectors must be used within a TicketInspectorsProvider')
    }
    return context
}
export const TicketInspectorsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [ticketInspectorList, setTicketInspectorList] = useState<Report[]>([])
    const [previousDayInspectors, setPreviousDayInspectors] = useState<Report[]>([])
    const lastReceivedInspectorTime = useRef<Date | null>(null)
    const lastFetchedPreviousDayTime = useRef<Date | null>(null)
    const riskData = useRiskData()
    const { get, getWithIfModifiedSince, isLoading, error } = useApi()

    const refreshInspectorsData = useCallback(async () => {
        const endTime = new Date().toISOString()
        const startTime = new Date(new Date(endTime).getTime() - 60 * 60 * 1000).toISOString()

        const response = await getWithIfModifiedSince<Report[]>(
            `/basics/inspectors?start=${startTime}&end=${endTime}`,
            lastReceivedInspectorTime.current
        )

        if (response.success && response.data && response.data.length > 0) {
            const data = response.data
            setTicketInspectorList((currentList) => {
                // Create a map to track the most recent entry per station Id
                const updatedList = new Map(currentList.map((inspector) => [inspector.station.id, inspector]))

                data.forEach((newInspector: Report) => {
                    const existingInspector = updatedList.get(newInspector.station.id)

                    if (existingInspector) {
                        // Compare timestamps and wether it is historic to decide if we need to update
                        if (
                            new Date(newInspector.timestamp) >= new Date(existingInspector.timestamp) &&
                            newInspector.isHistoric === false
                        ) {
                            updatedList.set(newInspector.station.id, newInspector)
                        }
                    } else {
                        // If no existing inspector with the same Id, add the new one
                        updatedList.set(newInspector.station.id, newInspector)
                    }
                })

                // Set the latest timestamp as if-modified-since header for the next request
                const latestTimestamp = Math.max(
                    ...data.map((inspector: Report) => new Date(inspector.timestamp).getTime())
                )
                lastReceivedInspectorTime.current = new Date(latestTimestamp)

                // Trigger risk data refresh
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
            return ticketInspectorList
        }

        if (shouldFetchPreviousDay) {
            const startTimeInRFC3339 = new Date(currentTime - 1000 * 60 * 60 * 24).toISOString()
            const endTimeInRFC3339 = new Date(currentTime - 1000 * 60 * 60).toISOString()

            const response = await get<Report[]>(
                `/basics/inspectors?start=${startTimeInRFC3339}&end=${endTimeInRFC3339}`
            )

            if (response.success && response.data) {
                // Filter out historic inspectors from previous day
                const filteredPreviousDayInspectorList = response.data.filter(
                    (inspector: Report) => !inspector.isHistoric
                )

                setPreviousDayInspectors(filteredPreviousDayInspectorList)
                lastFetchedPreviousDayTime.current = new Date()
            }
        }

        // Separate historic and recent inspectors from the last hour
        const historicInspectors = ticketInspectorList.filter((inspector) => inspector.isHistoric)
        const recentInspectors = ticketInspectorList.filter((inspector) => !inspector.isHistoric)

        const sortByTimestamp = (a: Report, b: Report): number =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()

        // Combine and sort all lists
        const sortedLists = [recentInspectors, historicInspectors, previousDayInspectors].map((list) =>
            list.sort(sortByTimestamp)
        )

        return sortedLists.flat()
    }, [ticketInspectorList, previousDayInspectors, get, error, isLoading])

    useEffect(() => {
        refreshInspectorsData().catch((error) => {
            // fix this later with sentry
            // eslint-disable-next-line no-console
            console.error('Error refreshing inspectors data:', error)
        })
        const interval = setInterval(refreshInspectorsData, 5 * 1000)

        return () => clearInterval(interval)
    }, [refreshInspectorsData])

    const value = useMemo(
        () => ({ ticketInspectorList, refreshInspectorsData, getLast24HourReports }),
        [ticketInspectorList, refreshInspectorsData, getLast24HourReports]
    )

    return <TicketInspectorsContext.Provider value={value}>{children}</TicketInspectorsContext.Provider>
}

// Todo:
// - rename to Reports stuff
// - sensible names
