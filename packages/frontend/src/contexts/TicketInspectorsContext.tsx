import React, { createContext, useCallback,useContext, useEffect, useMemo,useRef, useState } from 'react'
import { getRecentDataWithIfModifiedSince } from 'src/utils/databaseUtils'
import { Report } from 'src/utils/types'

import { useRiskData } from './RiskDataContext'

interface TicketInspectorsContextProps {
    ticketInspectorList: Report[]
    refreshInspectorsData: () => void
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
    const lastReceivedInspectorTime = useRef<Date | null>(null)
    const riskData = useRiskData()

    const refreshInspectorsData = useCallback(async () => {
        const endTime = new Date().toISOString()
        const startTime = new Date(new Date(endTime).getTime() - 60 * 60 * 1000).toISOString()
        const newTicketInspectorList = (await getRecentDataWithIfModifiedSince(
            `${process.env.REACT_APP_API_URL}/basics/inspectors?start=${startTime}&end=${endTime}`,
            lastReceivedInspectorTime.current
        ) as Report[] | null) ?? []

        if (newTicketInspectorList.length > 0) {
            setTicketInspectorList((currentList) => {
                // Create a map to track the most recent entry per station Id
                const updatedList = new Map(currentList.map((inspector) => [inspector.station.id, inspector]))

                newTicketInspectorList.forEach((newInspector: Report) => {
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
                lastReceivedInspectorTime.current = new Date(
                    Math.max(
                        ...newTicketInspectorList.map((inspector: Report) => new Date(inspector.timestamp).getTime())
                    )
                )
                riskData.refreshRiskData().catch((error) => {
                    // fix this later with sentry
                    // eslint-disable-next-line no-console
                    console.error('Error refreshing risk data:', error)
                })
                return Array.from(updatedList.values())
            })

            lastReceivedInspectorTime.current = new Date(
                Math.max(...newTicketInspectorList.map((inspector: Report) => new Date(inspector.timestamp).getTime()))
            )
            riskData.refreshRiskData().catch((error) => {
                // fix this later with sentry
                // eslint-disable-next-line no-console
                console.error('Error refreshing risk data:', error)
            })
        }
    }, [riskData])

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
        () => ({ ticketInspectorList, refreshInspectorsData }),
        [ticketInspectorList, refreshInspectorsData]
    )

    return (
        <TicketInspectorsContext.Provider value={value}>
            {children}
        </TicketInspectorsContext.Provider>
    )
}
