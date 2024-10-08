import { Statistics } from './types'

export interface StationProperty {
    name: string
    coordinates: {
        latitude: number
        longitude: number
    }
    lines: string[]
}

export type LineProperty = {
    [key: string]: string[]
}

export type StationList = Record<string, StationProperty>
export type LinesList = Record<string, string[]>

/**
 * Fetches recent data from the given endpoint with an optional If-Modified-Since header.
 *
 * @param {string} endpointUrl - The URL of the endpoint to fetch data from.
 * @param {string | null} lastUpdateTimestamp - The timestamp of the last successful update in "YYYY-MM-DD HH:mm:ss.SSSSSS" format, or null if no previous timestamp is available.
 * @returns {Promise<any | null>} A promise that resolves to the fetched data if successful, or null if there is no new data or an error occurs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getRecentDataWithIfModifiedSince(
    endpointUrl: string,
    lastUpdate: Date | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
    try {
        const headers = new Headers()
        // Include the If-Modified-Since header only if lastUpdateTimestamp is available
        if (lastUpdate) {
            headers.append('If-Modified-Since', lastUpdate.toUTCString())
        }

        // Make the request with optional If-Modified-Since header
        const response = await fetch(endpointUrl, {
            method: 'GET',
            headers: headers,
        })

        // Handle 304 Not Modified
        if (response.status === 304) {
            return null
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error:', error)
        return null // Return null in case of error
    }
}

export async function getAllStationsList(): Promise<StationList> {
    try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/stations`)
        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error:', error)
        return {}
    }
}

export async function getAllLinesList(): Promise<LinesList> {
    try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/lines`)
        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error:', error)
        return {}
    }
}

export async function reportInspector(line: string, stationId: string, directionId: string, message: string) {
    const requestBody = JSON.stringify({
        line: line,
        stationId: stationId || '',
        directionId: directionId || '',
        message: message || '',
    })

    fetch(`${process.env.REACT_APP_API_URL}/basics/inspectors`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: requestBody,
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            return response.json()
        })
        .catch((error) => console.error('Error:', error))
}

export async function getStationDistance(userStationId: string, inspectorStationId: string): Promise<number | null> {
    if (userStationId === '' || inspectorStationId === '') {
        return null
    }

    try {
        const url = `${process.env.REACT_APP_API_URL}/transit/distance?inspectorStationId=${encodeURIComponent(
            inspectorStationId
        )}&userStationId=${encodeURIComponent(userStationId)}`
        const response = await fetch(url)
        const data = await response.json()

        if (response.ok) {
            return typeof data === 'number' ? data : data.distance
        } else {
            console.error('API call failed:', data)
            return null
        }
    } catch (error) {
        console.error('Error fetching distance:', error)
        return null // Return null if there's an error during the fetch.
    }
}

export async function getNumberOfReportsInLast24Hours(): Promise<number> {
    try {
        // Calculate the start and end times for the last 24 hours in UTC
        const endTime = new Date().toISOString()
        const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        // Construct the URL with query parameters
        const url = new URL(`${process.env.REACT_APP_API_URL}/basics/inspectors`)
        url.searchParams.append('start', startTime)
        url.searchParams.append('end', endTime)

        const response = await fetch(url.toString())

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reports = await response.json()

        // Ensure that the response is an array
        if (!Array.isArray(reports)) {
            console.error('Unexpected response format:', reports)
            return 0
        }

        // filter out historic reports
        const filteredReports = reports.filter((report: { isHistoric: boolean }) => !report.isHistoric)

        return filteredReports.length
    } catch (error) {
        console.error('Error:', error)
        return 0
    }
}

export async function fetchNumberOfReports(stationId: string): Promise<number> {
    try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/stations/${stationId}/statistics`)
        const data = (await response.json()) as Statistics
        return data.numberOfReports
    } catch (error) {
        console.error('Error:', error)
        return 0
    }
}
