import { useApi } from './useApi'

export const useFeedback = () => {
    const { fetchWithError, error, isLoading } = useApi()

    const submitFeedback = async (feedback: string): Promise<boolean> => {
        if (!feedback.trim()) {
            return false
        }

        try {
            const result = await fetchWithError<{ success: boolean }>('/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ feedback }),
            })

            return result?.success ?? false
        } catch (error) {
            // fix later with sentry
            // eslint-disable-next-line no-console
            console.error('Error submitting feedback:', error)
            return false
        }
    }

    return { submitFeedback, error, isLoading }
}
