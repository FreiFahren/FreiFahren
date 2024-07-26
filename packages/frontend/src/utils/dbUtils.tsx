import { selectOption } from '../components/Form/AutocompleteInputForm/AutocompleteInputForm';
import { AnalyticsOptions } from './types';

export interface StationProperty {
	name: string;
	coordinates: {
		latitude: number;
		longitude: number;
	};
	lines: string[];
}

export type LineProperty = {
    [key: string]: string[];
}

export type StationList = Record<string, StationProperty>;
export type LinesList = Record<string, string[]>;

/**
 * Fetches recent data from the given endpoint with an optional If-Modified-Since header.
 *
 * @param {string} endpointUrl - The URL of the endpoint to fetch data from.
 * @param {string | null} lastUpdateTimestamp - The timestamp of the last successful update in "YYYY-MM-DD HH:mm:ss.SSSSSS" format, or null if no previous timestamp is available.
 * @returns {Promise<any | null>} A promise that resolves to the fetched data if successful, or null if there is no new data or an error occurs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getRecentDataWithIfModifiedSince(endpointUrl: string, lastUpdate: Date | null): Promise<any | null> {
    try {
        const headers = new Headers();
        // Include the If-Modified-Since header only if lastUpdateTimestamp is available
        if (lastUpdate) {
            headers.append('If-Modified-Since', lastUpdate.toUTCString())
        }

        // Make the request with optional If-Modified-Since header
        const response = await fetch(endpointUrl, {
            method: 'GET',
            headers: headers,
        });

        // Handle 304 Not Modified
        if (response.status === 304) {
            return null;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error:', error);
        return null; // Return null in case of error
    }
}

export async function getAllStationsList(): Promise<StationList> {
  try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/data/list?stations=true`);
      const data = await response.json();
      return data;
  } catch (error) {
      console.error('Error:', error);
      return {};
  }
}

export async function getAllLinesList(): Promise<LinesList> {
  try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/data/list?lines=true`);
      const data = await response.json();
      return data;
  } catch (error) {
      console.error('Error:', error);
      return {};
  }
}

async function fetchStationId(stationName: string): Promise<string | null> {
    if (!stationName) {
        return null;
    }

    try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/data/id?name=${stationName}`);
        const stationJson = await response.json();
        return stationJson.id;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

export async function reportInspector(line: selectOption, station: selectOption, direction: selectOption, message: string) {
    // when the user doesn't select a line, station or direction, the value is undefined
    const stationId = station ? await fetchStationId(station.label) : null;
    const directionId = direction ? await fetchStationId(direction.label) : null;

    const requestBody = JSON.stringify({
        line: line ? line.value : '',
        stationId: stationId || '',
        directionId: directionId || '',
        message: message || '',
    });

    fetch(`${process.env.REACT_APP_API_URL}/basics/inspectors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: requestBody
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .catch((error) => console.error('Error:', error));
}

export async function getStationDistance(userLat: number | undefined, userLon: number | undefined, inspectorStationId: string): Promise<number | null> {
    if (userLat === undefined || userLon === undefined) {
        return null;
    }

    try {
        const url = `${process.env.REACT_APP_API_URL}/transit/distance?inspectorStationId=${encodeURIComponent(inspectorStationId)}&userLat=${userLat}&userLon=${userLon}`;
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            return typeof data === 'number' ? data : data.distance;
        } else {
            console.error('API call failed:', data);
            return null;
        }
    } catch (error) {
        console.error('Error fetching distance:', error);
        return null;  // Return null if there's an error during the fetch.
    }
}

export async function getNumberOfReportsInLast24Hours(): Promise<number> {
    try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/statistics/stats`);
        const reportNumber = await response.json();
        return reportNumber;
    } catch (error) {
        console.error('Error:', error);
        return 0;
    }
}

export function getDataFromLocalStorage(key: string) {
    return localStorage.getItem(key);
}

export function sendAnalyticsEvent(eventName: string, options?: AnalyticsOptions): void {
    if (window.pirsch) {
      window.pirsch(eventName, options || {});
    } else {
      console.warn('Pirsch SDK not loaded');
    }
  }
