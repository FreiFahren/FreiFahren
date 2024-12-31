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
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()
            return data
        } catch (err) {
            setError({ message: err instanceof Error ? err.message : 'An error occurred' })
            return null
        } finally {
            setIsLoading(false)
        }
    }

    return { fetchWithError, error, isLoading }
}
