import { useState } from 'react'

interface ApiError {
    message: string
    status?: number
}

export const useApi = () => {
    const [error, setError] = useState<ApiError | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    const fetchWithError = async <T>(url: string, options?: RequestInit): Promise<T | null> => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}${url}`, options)
            const responseText = await response.text()

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            // Try to parse the response as JSON if it's not empty
            let data: T | null = null
            if (responseText.trim()) {
                try {
                    data = JSON.parse(responseText) as T
                } catch (parseError) {
                    // eslint-disable-next-line no-console
                    console.error('🚨 JSON Parse Error:', parseError)
                    throw new Error('Invalid JSON response from server')
                }
            }

            return data
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('🚨 API Error:', err)
            setError({ message: err instanceof Error ? err.message : 'An error occurred' })
            return null
        } finally {
            setIsLoading(false)
        }
    }

    return { fetchWithError, error, isLoading }
}
