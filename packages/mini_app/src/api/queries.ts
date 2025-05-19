import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LinesList, Report, StationList } from '../utils/types';

// Basic CACHE_KEYS structure, expand as needed
export const CACHE_KEYS = {
  stations: ['stationsETag'],
  lines: ['linesETag'],
  reports: ['reports'],
  byTimeframe: (timeframe: string) => ['reports', timeframe], // Example, adjust if ReportForm uses it
};

export const fetchWithETag = async <T>(endpoint: string, storageKeyPrefix: string): Promise<T> => {
    const etagKey: string = `${storageKeyPrefix}ETag`;
    const dataKey: string = `${storageKeyPrefix}Data`;
    const cachedETag: string | null = localStorage.getItem(etagKey);

    const headers: HeadersInit = {
        Accept: 'application/json',
    };
    if (cachedETag !== null && cachedETag !== '') {
        headers['If-None-Match'] = cachedETag;
    }

    const response: Response = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, { headers });
    const newETag: string | null = response.headers.get('ETag');

    if (response.status === 304) {
        const cachedData: string | null = localStorage.getItem(dataKey);
        if (cachedData !== null) {
            return JSON.parse(cachedData) as T;
        }
        // If 304 but no cached data, we should probably fetch fresh
    }

    if (!response.ok && response.status !== 304) { // ensure we don't throw on 304
        throw new Error(`Failed to fetch data: ${response.status}`);
    }
    
    if (response.status === 200) { // only process and cache if data is actually new
      if (newETag !== null) {
          localStorage.setItem(etagKey, newETag);
      }

      const newData: T = await response.json();
      localStorage.setItem(dataKey, JSON.stringify(newData));
      return newData;
    }
    
    // Fallback for 304 with no cache, or other non-200/non-error states if any
    // This part might need refinement based on actual API behavior for 304
    const cachedDataFallback: string | null = localStorage.getItem(dataKey);
    if (cachedDataFallback) return JSON.parse(cachedDataFallback) as T;
    
    // If really nothing, throw or return an empty/default state
    throw new Error('Failed to retrieve data and no cache available.');
};

export const useStations = () =>
    useQuery<StationList, Error>({
        queryKey: CACHE_KEYS.stations,
        queryFn: () => fetchWithETag<StationList>('/v0/stations', 'stations'),
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
    });

export const useLines = () =>
    useQuery<[string, string[]][], Error>({
        queryKey: CACHE_KEYS.lines,
        queryFn: async (): Promise<[string, string[]][]> => {
            const groupPriority = (key: string): number => {
                if (key.includes('U')) return 0;
                if (key.includes('S')) return 1;
                if (key.includes('M')) return 2;
                if (/^\d+$/.test(key)) return 4; // Lowest priority (4) for numeric keys
                return 3; // Default priority (3) for others
            };

            const data = await fetchWithETag<LinesList>('/v0/lines', 'lines');
            const sortedEntries = Object.entries(data).sort((a, b) => {
                const groupA = groupPriority(a[0]);
                const groupB = groupPriority(b[0]);
                if (groupA !== groupB) {
                    return groupA - groupB;
                }
                return a[0].localeCompare(b[0], undefined, { numeric: true });
            });

            return sortedEntries;
        },
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        structuralSharing: true,
    });

export const useSubmitReport = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (report: Report) => {
            const requestBody = {
                timestamp: new Date(report.timestamp),
                line: report.line ?? '',
                stationId: report.station.id,
                directionId: report.direction?.id ?? '',
                message: report.message ?? '',
                author: '77105110105', // ascii for Mini
            };

            const response = await fetch(`${import.meta.env.VITE_API_URL}/v0/basics/inspectors`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.reports });
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.byTimeframe('24h') });
            queryClient.invalidateQueries({ queryKey: CACHE_KEYS.byTimeframe('1h') });
        },
    });
}; 