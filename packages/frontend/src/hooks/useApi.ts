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

const logApiError = (error: ApiError, context?: string) => {
    // eslint-disable-next-line no-console
    console.error(
        `🚨 API Error [${error.method} ${error.url}]${context ? ` (${context})` : ''}:`,
        error.status ? `Status ${error.status}:` : '',
        error.message
    )
}

export const useApi = () => {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<ApiError | null>(null)

    const handleRequest = async <T>(
        url: string,
        options?: RequestOptions
    ): Promise<{ success: boolean; data: T | null }> => {
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
                body: options?.body ? JSON.stringify(options.body) : undefined,
            })

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
                return { success: false, data: null }
            }

            if (responseText.trim()) {
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
            return { success: true, data }
        } catch (err) {
            const apiError: ApiError = {
                message: err instanceof Error ? err.message : 'An error occurred',
                status: err instanceof Error && 'status' in err ? (err as any).status : undefined,
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
        post,
        error,
        isLoading,
    }
}
