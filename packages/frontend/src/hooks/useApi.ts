import { useState } from 'react'

interface ApiError {
    message: string
    status?: number
    url?: string
    method?: string
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
    body?: unknown
}

interface ErrorWithStatus extends Error {
    status?: number
}

const logApiError = (error: ApiError, context?: string) => {
    // eslint-disable-next-line no-console
    console.error(
        `🚨 API Error [${error.method ?? 'UNKNOWN'} ${error.url ?? 'UNKNOWN'}]${
            context !== undefined ? ` (${context})` : ''
        }:`,
        error.status !== undefined ? `Status ${error.status}:` : '',
        error.message
    )
}

export const useApi = () => {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<ApiError | null>(null)

    const handleRequest = async <T>(
        url: string,
        options?: RequestOptions
    ): Promise<{ success: boolean; data: T | null; status?: number }> => {
        const baseUrl = process.env.REACT_APP_API_URL
        const fullUrl = `${baseUrl}${url}`
        const headers = {
            'Content-Type': 'application/json',
            ...options?.headers,
        }

        try {
            const response = await fetch(fullUrl, {
                ...options,
                headers,
                body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
            })

            // Handle 304 Not Modified
            if (response.status === 304) {
                return { success: true, data: null, status: 304 }
            }

            const responseText = await response.text()
            let data: T | null = null

            if (!response.ok) {
                const apiError: ApiError = {
                    message: `HTTP error! status: ${response.status}`,
                    status: response.status,
                    url,
                    method: options?.method,
                }
                setError(apiError)
                logApiError(apiError)
                return { success: false, data: null, status: response.status }
            }

            if (responseText.trim().length > 0) {
                try {
                    data = JSON.parse(responseText) as T
                } catch (parseError) {
                    const apiError: ApiError = {
                        message: 'Invalid JSON response from server',
                        url,
                        method: options?.method,
                    }
                    setError(apiError)
                    logApiError(apiError, 'JSON Parse Error')
                    return { success: false, data: null }
                }
            }

            setError(null)
            return { success: true, data, status: response.status }
        } catch (err) {
            const caughtError = err as ErrorWithStatus
            const apiError: ApiError = {
                message: caughtError.message || 'An error occurred',
                status: caughtError.status,
                url,
                method: options?.method,
            }
            setError(apiError)
            logApiError(apiError, 'Network/Request Error')
            return { success: false, data: null }
        }
    }

    const get = async <T>(url: string, options?: Omit<RequestOptions, 'method' | 'body'>) => {
        setIsLoading(true)

        try {
            return await handleRequest<T>(url, { ...options, method: 'GET' })
        } finally {
            setIsLoading(false)
        }
    }

    const getWithIfModifiedSince = async <T>(url: string, lastUpdate: Date | null) => {
        try {
            const headers: HeadersInit = {}
            if (lastUpdate) {
                headers['If-Modified-Since'] = lastUpdate.toUTCString()
            }

            const response = await handleRequest<T>(url, { method: 'GET', headers })

            // Only set loading state if it's not a 304 to not cause rerender
            if (response.status !== 304) {
                setIsLoading(true)
            }

            return response
        } finally {
            // Only reset loading state if we set it before
            if (isLoading) {
                setIsLoading(false)
            }
        }
    }

    const post = async <T>(url: string, body: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) => {
        setIsLoading(true)

        try {
            return await handleRequest<T>(url, { ...options, method: 'POST', body })
        } finally {
            setIsLoading(false)
        }
    }

    return {
        get,
        getWithIfModifiedSince,
        post,
        error,
        isLoading,
    }
}
