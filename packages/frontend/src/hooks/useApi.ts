import { addBreadcrumb, captureMessage, withScope } from '@sentry/react'
import { useState } from 'react'

interface ApiError {
    message: string
    status?: number
    url?: string
    method?: string
    context?: Record<string, unknown>
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
    body?: unknown
    errorContext?: Record<string, unknown>
}

interface ErrorWithStatus extends Error {
    status?: number
}

const logApiError = (error: ApiError) => {
    // Add error to Sentry with full context
    withScope((scope) => {
        scope.setTag('api_error', 'true')
        scope.setTag('api_method', error.method ?? 'UNKNOWN')
        scope.setTag('api_url', error.url ?? 'UNKNOWN')

        if (error.status !== undefined) {
            scope.setTag('http_status', error.status.toString())
        }

        if (error.context) {
            scope.setContext('api_call_context', error.context)
        }

        captureMessage(`API Error: ${error.message}`, 'error')
    })

    // Still log to console in development
    if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error(
            `🚨 API Error [${error.method ?? 'UNKNOWN'} ${error.url ?? 'UNKNOWN'}]:`,
            error.status !== undefined ? `Status ${error.status}:` : '',
            error.message,
            error.context ?? ''
        )
    }
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

        // Add breadcrumb for API call start
        addBreadcrumb({
            category: 'api',
            message: `API Request Started: ${options?.method ?? 'UNKNOWN'} ${url}`,
            level: 'info',
            data: {
                url: fullUrl,
                method: options?.method,
                headers,
                hasBody: options?.body !== undefined,
            },
        })

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

            // Add breadcrumb for API response
            addBreadcrumb({
                category: 'api',
                message: `API Response Received: ${response.status}`,
                level: response.ok ? 'info' : 'error',
                data: {
                    status: response.status,
                    statusText: response.statusText,
                    url: fullUrl,
                    method: options?.method,
                },
            })

            const responseText = await response.text()
            let data: T | null = null

            if (!response.ok) {
                const apiError: ApiError = {
                    message: `HTTP error! status: ${response.status}`,
                    status: response.status,
                    url,
                    method: options?.method,
                    context: {
                        ...options?.errorContext,
                        responseText: responseText.slice(0, 1000), // Limit size of error context
                    },
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
                        context: {
                            ...options?.errorContext,
                            parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
                            responseText: responseText.slice(0, 1000),
                        },
                    }
                    setError(apiError)
                    logApiError(apiError)
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
                context: {
                    ...options?.errorContext,
                    errorType: caughtError.constructor.name,
                    errorStack: caughtError.stack,
                },
            }
            setError(apiError)
            logApiError(apiError)
            return { success: false, data: null }
        }
    }

    const get = async <T>(url: string, options?: Omit<RequestOptions, 'method' | 'body'>) => {
        setIsLoading(true)

        // Add breadcrumb for GET request
        addBreadcrumb({
            category: 'api',
            message: `GET Request: ${url}`,
            level: 'info',
        })

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

        // Add breadcrumb for POST request
        addBreadcrumb({
            category: 'api',
            message: `POST Request: ${url}`,
            level: 'info',
        })

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
