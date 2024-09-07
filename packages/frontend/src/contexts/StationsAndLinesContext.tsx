import React, { createContext, useContext, useState, useEffect } from 'react'
import { getAllLinesList, getAllStationsList, LinesList, StationList } from '../utils/dbUtils'

interface StationsAndLinesContextType {
    allLines: LinesList
    allStations: StationList
    isLoading: boolean
}

const StationsAndLinesContext = createContext<StationsAndLinesContextType | undefined>(undefined)

export const StationsAndLinesProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [allLines, setAllLines] = useState<LinesList>({})
    const [allStations, setAllStations] = useState<StationList>({})
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchLinesAndStations = async () => {
            try {
                const [lines, stations] = await Promise.all([getAllLinesList(), getAllStationsList()])
                setAllLines(lines)
                setAllStations(stations)
            } catch (error) {
                console.error('Failed to fetch lines and stations:', error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchLinesAndStations()
    }, [])

    return (
        <StationsAndLinesContext.Provider value={{ allLines, allStations, isLoading }}>
            {children}
        </StationsAndLinesContext.Provider>
    )
}

export const useStationsAndLines = () => {
    const context = useContext(StationsAndLinesContext)
    if (context === undefined) {
        throw new Error('useStationsAndLines must be used within a StationsAndLinesProvider')
    }
    return context
}
