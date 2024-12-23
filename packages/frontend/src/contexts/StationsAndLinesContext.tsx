import React, { createContext, useContext, useEffect,useMemo,useState } from 'react'

import { getAllLinesList, getAllStationsList, LinesList, StationList } from '../utils/databaseUtils'

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

                // sort them because Ubahns are more common than Sbahns, thus they have to first
                const sortedAllLines = () => Object.fromEntries(
                        Object.entries(lines).sort(([lineA], [lineB]) => {
                            // fix later, the fuck u wanna destructure
                            // eslint-disable-next-line prefer-destructuring
                            const typeA = lineA[0]
                            // eslint-disable-next-line prefer-destructuring
                            const typeB = lineB[0]
                            const numberA = parseInt(lineA.slice(1), 10)
                            const numberB = parseInt(lineB.slice(1), 10)

                            if (typeA !== typeB) {
                                return typeB.localeCompare(typeA) // U comes before S
                            }

                            // Ringbahn should be first Sbahn because they are the most common Sbahns
                            if (typeA === 'S' && typeB === 'S') {
                                if (lineA === 'S41') return -1
                                if (lineB === 'S41') return 1
                                if (lineA === 'S42') return -1
                                if (lineB === 'S42') return 1
                            }

                            return numberA - numberB // Sort by number
                        })
                    )

                setAllLines(sortedAllLines)
                setAllStations(stations)
            } catch (error) {
                // fix this later with sentry
                // eslint-disable-next-line no-console
                console.error('Failed to fetch lines and stations:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchLinesAndStations().catch((error) => {
            // fix this later with sentry
            // eslint-disable-next-line no-console
            console.error('Failed to fetch lines and stations:', error)
        })
    }, [])

    const value = useMemo(
        () => ({ allLines, allStations, isLoading }),
        [allLines, allStations, isLoading]
    )

    return (
        <StationsAndLinesContext.Provider value={value}>
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
