import { useCallback, useEffect, useRef, useState } from 'react'

interface ETagCacheOptions {
    endpoint: string
    storageKeyPrefix?: string
    onError?: (error: Error) => void
}

interface ETagCacheResult<T> {
    data: T | null
    isLoading: boolean
    error: Error | null
    invalidateCache: () => void
    refetch: () => Promise<void>
}

interface StorageKeys {
    etagKey: string
    dataKey: string
}

/**
 * A React hook that implements ETag-based caching for API requests.
 *
 * This hook provides efficient data fetching with automatic caching using HTTP ETags.
 * It stores both the ETag and the response data in localStorage, allowing for:
 * - Conditional requests (304 Not Modified responses)
 * - Persistent caching across page reloads
 * - Automatic cache invalidation when data changes
 * - Manual cache control when needed
 *
 * @template T - The type of data being cached
 *
 * @example
 * // Basic usage
 * const { data, isLoading } = useETagCache<UserData>({
 *   endpoint: '/api/user',
 *   storageKeyPrefix: 'user'
 * });
 *
 * @example
 * // Complete usage with all features
 * const {
 *   data,
 *   isLoading,
 *   error,
 *   invalidateCache,
 *   refetch
 * } = useETagCache<UserData>({
 *   endpoint: '/api/user',
 *   storageKeyPrefix: 'user',
 *   onError: (error) => {
 *     console.error('Failed to fetch user data:', error);
 *     showErrorNotification(error.message);
 *   }
 * });
 *
 * @example
 * // Usage with GeoJSON data
 * const { data: lineSegments } = useETagCache<GeoJSON.FeatureCollection>({
 *   endpoint: '/lines/segments',
 *   storageKeyPrefix: 'segments'
 * });
 *
 * @example
 * // Manual cache invalidation
 * const { invalidateCache } = useETagCache<UserData>({
 *   endpoint: '/api/user',
 *   storageKeyPrefix: 'user'
 * });
 *
 * // Later in your code
 * const handleRefresh = () => {
 *   invalidateCache(); // Clears cache and fetches fresh data
 * };
 *
 *  *
 * @remarks
 * - The hook automatically handles the initial fetch on mount
 * - Subsequent fetches only occur when manually triggered
 * - Cache invalidation clears both ETag and data from localStorage
 * - Falls back to cached data if network request fails
 * - Uses localStorage for persistent caching
 *
 * @throws {Error}
 * - When the fetch request fails
 * - When JSON parsing of cached data fails
 * - When localStorage is not available
 *
 * @param {ETagCacheOptions} options - Configuration options for the cache
 * @returns {ETagCacheResult<T>} An object containing the cached data and control functions
 */
export const useETagCache = <T,>({ endpoint, storageKeyPrefix = '', onError }: ETagCacheOptions): ETagCacheResult<T> => {
    const [data, setData] = useState<T | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    // Use refs for storage keys to prevent dependency changes
    const storageKeys = useRef<StorageKeys>({
        etagKey: `${storageKeyPrefix}ETag`,
        dataKey: `${storageKeyPrefix}Data`,
    }).current

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true)
            const cachedETag = localStorage.getItem(storageKeys.etagKey)

            const response = await fetch(`${process.env.REACT_APP_API_URL}${endpoint}`, {
                headers: {
                    'If-None-Match': cachedETag ?? '',
                    Accept: 'application/json',
                },
            })

            const newETag = response.headers.get('ETag')

            if (response.status === 304) {
                const cachedData = localStorage.getItem(storageKeys.dataKey)

                if (cachedData !== null) {
                    setData(JSON.parse(cachedData))
                    return
                }
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch data: ${response.status}`)
            }

            if (newETag !== null) {
                localStorage.setItem(storageKeys.etagKey, newETag)
            }

            const newData = await response.json()

            localStorage.setItem(storageKeys.dataKey, JSON.stringify(newData))
            setData(newData)
        } catch (caughtError) {
            const errorMessage = caughtError instanceof Error ? caughtError.message : 'An unknown error occurred'
            const customError = new Error(errorMessage)

            setError(customError)
            onError?.(customError)

            const cachedData = localStorage.getItem(storageKeys.dataKey)

            if (cachedData !== null) {
                setData(JSON.parse(cachedData))
            }
        } finally {
            setIsLoading(false)
        }
    }, [endpoint, onError, storageKeys])

    const hasInitialFetch = useRef(false)

    useEffect(() => {
        if (!hasInitialFetch.current) {
            fetchData().catch((caughtError) => {
                // eslint-disable-next-line no-console
                console.error('Failed to fetch initial data:', caughtError)
                throw caughtError
            })
            hasInitialFetch.current = true
        }
    }, [fetchData])

    const invalidateCache = useCallback(() => {
        localStorage.removeItem(storageKeys.etagKey)
        localStorage.removeItem(storageKeys.dataKey)

        fetchData().catch((caughtError) => {
            // eslint-disable-next-line no-console
            console.error('Failed to fetch initial data:', caughtError)
            throw caughtError
        })
    }, [fetchData, storageKeys])

    return {
        data,
        isLoading,
        error,
        invalidateCache,
        refetch: fetchData,
    }
}
