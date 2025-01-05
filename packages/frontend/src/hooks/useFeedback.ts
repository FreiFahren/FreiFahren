import { useApi } from './useApi'

interface FeedbackResponse {
    success: boolean
}

export const useFeedback = () => {
    const { post, error, isLoading } = useApi()

    const submitFeedback = async (feedback: string): Promise<boolean> => {
        if (!feedback.trim()) {
            return false
        }

        const { success } = await post<FeedbackResponse>('/feedback', { feedback })
        return success
    }

    return { submitFeedback, error, isLoading }
}
