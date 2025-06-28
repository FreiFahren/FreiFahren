import Fuse from 'fuse.js'
import { useMemo, useState } from 'react'

import { useStations } from '../api/queries'
import { Station } from '../utils/types'

type SearchResult = {
    filteredStations: Station[]
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

    // Convert StationList to Station array
    const stationsArray = useMemo(() => {
        if (!allStations) return []
        return Object.entries(allStations).map(([id, stationProperty]) => ({
            id,
            name: stationProperty.name,
            coordinates: stationProperty.coordinates,
            lines: stationProperty.lines,
        }))
    }, [allStations])

    // Helper function to remove single S and U from station names for better search
    const preprocessName = (name: string): string => name.replace(/^(S|U)\s+/i, ' ')

    // Create fuzzy search instance
    const fuse = useMemo(() => {
        if (stationsArray.length === 0) return null

        const processedStations = stationsArray.map((station) => ({
            ...station,
            processedName: preprocessName(station.name),
        }))

        return new Fuse(processedStations, {
            keys: ['processedName', 'name'],
            threshold: 0.4,
            distance: 100,
        })
    }, [stationsArray])

    // Filter stations based on search input
    const filteredStations = useMemo(() => {
        if (stationsArray.length === 0) return []
        if (searchValue === '' || fuse === null) {
            // Return all stations or limited number if specified
            return limit !== undefined ? stationsArray.slice(0, limit) : stationsArray
        }

        const processedSearchValue = preprocessName(searchValue)
        const searchResults = fuse.search(processedSearchValue)

        // Limit results if specified and extract the station objects
        const limitedResults = limit !== undefined ? searchResults.slice(0, limit) : searchResults
        return limitedResults.map((result) => ({
            id: result.item.id,
            name: result.item.name,
            coordinates: result.item.coordinates,
            lines: result.item.lines,
        }))
    }, [stationsArray, searchValue, fuse, limit])

    return {
        filteredStations,
        searchValue,
        setSearchValue,
    }
}
