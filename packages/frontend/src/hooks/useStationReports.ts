import { useEffect, useRef, useState } from 'react'

type Statistics = {
    numberOfReports: number
}

/**
 * A hook that fetches the number of reports within the last 7 days for a given station.
 * This hook directly makes an API call without using useEffect to avoid unnecessary re-renders.
 * It uses a ref to ensure only one fetch request is active at a time.
 *
 * @param stationId - The unique identifier of the station to fetch reports for
 * @returns number - The number of reports for the station. Defaults to 0 if there's an error or no data
 *
 * @example
 * ```tsx
 * const MyComponent = ({ stationId }) => {
 *   const numberOfReports = useStationReports(stationId)
 *   return <div>Number of reports: {numberOfReports}</div>
 * }
 * ```
 */
export const useStationReports = (stationId: string): number => {
    const [numberOfReports, setNumberOfReports] = useState<number>(0)
    const fetchingRef = useRef(false) // ensure only one fetch is made

    useEffect(() => {
        if (stationId && !fetchingRef.current) {
            fetchingRef.current = true
            fetch(`${process.env.REACT_APP_API_URL}/v0/stations/${stationId}/statistics`)
                .then((response) => response.json())
                .then((data: Statistics) => {
                    setNumberOfReports(data.numberOfReports)
                    fetchingRef.current = false
                })
                .catch((error) => {
                    // fix this later with sentry
                    // eslint-disable-next-line no-console
                    console.error('Error fetching reports:', error)
                    setNumberOfReports(0)
                    fetchingRef.current = false
                })
        }
    }, [stationId])

    return numberOfReports
}
