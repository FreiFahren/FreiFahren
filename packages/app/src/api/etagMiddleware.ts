import AsyncStorage from '@react-native-async-storage/async-storage'
import { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { isNil } from 'lodash'

interface ETagCacheConfig {
    endpoints: (string | RegExp)[]
    storageKeyPrefix?: string
    shouldCache?: (config: InternalAxiosRequestConfig) => boolean
    onCacheHit?: (url: string) => void
    onCacheUpdate?: (url: string) => void
}

export const createETagMiddleware = (params: ETagCacheConfig) => {
    const { endpoints, storageKeyPrefix = 'etag_', shouldCache = () => true, onCacheHit, onCacheUpdate } = params

    const shouldCacheEndpoint = (url: string): boolean => {
        return endpoints.some((endpoint) => {
            if (typeof endpoint === 'string') {
                return url.includes(endpoint)
            }
            return endpoint.test(url)
        })
    }

    const getStorageKeys = (url: string) => {
        const safeUrl = url.replace(/[^a-zA-Z0-9]/g, '')

        return {
            etagKey: `${storageKeyPrefix}etag_${safeUrl}`,
            dataKey: `${storageKeyPrefix}data_${safeUrl}`,
        }
    }

    const clearCache = async (url: string): Promise<void> => {
        const { etagKey, dataKey } = getStorageKeys(url)

        await Promise.all([AsyncStorage.removeItem(etagKey), AsyncStorage.removeItem(dataKey)])
    }

    const clearAllCaches = async (): Promise<void> => {
        try {
            const keys = await AsyncStorage.getAllKeys()

            const etagKeys = keys.filter((key) => key.startsWith(storageKeyPrefix))

            if (etagKeys.length > 0) {
                await AsyncStorage.multiRemove(etagKeys)
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to clear ETag caches:', error)
        }
    }

    const requestInterceptor = async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
        const { url } = config

        if (url === undefined || !shouldCacheEndpoint(url) || !shouldCache(config)) {
            return config
        }

        try {
            const { etagKey } = getStorageKeys(url)
            const etag = await AsyncStorage.getItem(etagKey)

            if (etag !== null && etag !== '') {
                // eslint-disable-next-line no-param-reassign
                config.headers['If-None-Match'] = etag
            } else {
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error retrieving ETag from cache:', error)
        }

        return config
    }

    const responseInterceptor = async (response: AxiosResponse): Promise<AxiosResponse> => {
        const { url } = response.config

        if (url === undefined || !shouldCacheEndpoint(url) || !shouldCache(response.config)) {
            return response
        }

        const { etagKey, dataKey } = getStorageKeys(url)

        if (response.status === 304) {
            try {
                const cachedData = await AsyncStorage.getItem(dataKey)

                if (cachedData !== null) {
                    // eslint-disable-next-line no-param-reassign
                    response.data = JSON.parse(cachedData)
                    onCacheHit?.(url)
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Error retrieving cached data:', error)
            }

            return response
        }

        if (!isNil(response.data) && response.headers.etag !== undefined) {
            try {
                await AsyncStorage.setItem(etagKey, response.headers.etag)
                await AsyncStorage.setItem(dataKey, JSON.stringify(response.data))
                onCacheUpdate?.(url)
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Error caching response data:', error)
            }
        }

        return response
    }

    const applyMiddleware = (axiosInstance: AxiosInstance): void => {
        axiosInstance.interceptors.request.use(requestInterceptor)
        axiosInstance.interceptors.response.use(responseInterceptor)
    }

    return {
        requestInterceptor,
        responseInterceptor,
        applyMiddleware,
        clearCache,
        clearAllCaches,
    }
}
