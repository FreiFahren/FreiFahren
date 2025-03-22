import { useMemo, useState } from 'react'
import { useStations } from '../api/queries'
import { StationProperty } from '../utils/types'
import Fuse from 'fuse.js'

type SearchResult = {
    filteredStations: Record<string, StationProperty>
    searchValue: string
    setSearchValue: (value: string) => void
}

/**
 * Hook for searching through stations using fuzzy search
 * @param initialSearchValue Initial search value
 * @param limit Maximum number of results to return (default: no limit)
 * @returns `SearchResult` object
 */
export const useStationSearch = (initialSearchValue: string = '', limit?: number): SearchResult => {
    const [searchValue, setSearchValue] = useState(initialSearchValue)
    const { data: allStations } = useStations()

    // Helper function to remove single S and U from station names for better search
    const preprocessName = (name: string): string => name.replace(/^(S|U)\s+/i, ' ')

    // Create fuzzy search instance
    const fuse = useMemo(() => {
        if (allStations === undefined) return null

        const stations = Object.entries(allStations).map(([id, station]) => ({
            id,
            ...station,
            processedName: preprocessName(station.name),
        }))

        return new Fuse(stations, {
            keys: ['processedName', 'name'],
            threshold: 0.4,
            distance: 100,
        })
    }, [allStations])

    // Filter stations based on search input
    const filteredStations = useMemo(() => {
        if (allStations === undefined) return {}
        if (searchValue === '' || fuse === null) {
            // Return all stations or limited number if specified
            const stations = Object.entries(allStations)

            if (limit !== undefined && stations.length > limit) {
                return Object.fromEntries(stations.slice(0, limit))
            }

            return allStations
        }

        const processedSearchValue = preprocessName(searchValue)
        const searchResults = fuse.search(processedSearchValue)

        // Limit results if specified
        const limitedResults = limit !== undefined ? searchResults.slice(0, limit) : searchResults

        return Object.fromEntries(limitedResults.map((result) => [result.item.id, allStations[result.item.id]]))
    }, [allStations, searchValue, fuse, limit])

    return {
        filteredStations,
        searchValue,
        setSearchValue,
    }
}
