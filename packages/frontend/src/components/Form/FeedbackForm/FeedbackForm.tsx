import './FeedbackForm.css'

import { ChangeEvent, FC, useActionState, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { sendAnalyticsEvent } from '../../../hooks/useAnalytics'
import { ContactSection } from '../../Modals/ContactSection/ContactSection'
import { FeedbackSummaryModal } from '../../Modals/FeedbackSummaryModal/FeedbackSummaryModal'
import { PrivacyCheckbox } from '../PrivacyCheckbox/PrivacyCheckbox'

const submitFeedback = async (previousState: boolean | null, formData: FormData): Promise<boolean> => {
    const feedback = formData.get('feedback') as string

    if (!feedback.trim()) {
        throw new Error('Feedback cannot be empty')
    }

    try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ feedback }),
        })

        if (!response.ok) {
            throw new Error('Failed to submit feedback')
        }

        await sendAnalyticsEvent('Feedback submitted', {})
        return true
    } catch (error) {
        // fix later with sentry
        // eslint-disable-next-line no-console
        console.error('Error submitting feedback:', error)
        throw new Error('Failed to submit feedback')
    }
}

interface FeedbackFormProps {
    openAnimationClass?: string
    onClose?: () => void
}

const FeedbackForm: FC<FeedbackFormProps> = ({ openAnimationClass, onClose }) => {
    const { t } = useTranslation()
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [showSummary, formAction, isPending] = useActionState(submitFeedback, false)
    const [isChecked, setIsChecked] = useState(false)
    const [hasContent, setHasContent] = useState(false)

    const handleInput = (event: ChangeEvent<HTMLTextAreaElement>) => {
        const textarea = event.target
        const value = textarea.value.trim()
        setHasContent(value.length > 0)

        // Adjust textarea height using the ref
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
        }
    }

    const handleCheckboxChange = (checked: boolean) => {
        setIsChecked(checked)
    }

    const isSubmitEnabled = isChecked && hasContent && !isPending

    if (showSummary) {
        return <FeedbackSummaryModal openAnimationClass={openAnimationClass} handleCloseModal={() => onClose?.()} />
    }

    return (
        <div className={`feedback-form modal container ${openAnimationClass}`}>
            <h1>{t('FeedbackForm.title')}</h1>
            <p className="description">{t('FeedbackForm.description')}</p>
            <form action={formAction}>
                <textarea
                    ref={textareaRef}
                    name="feedback"
                    placeholder={t('FeedbackForm.descriptionPlaceholder')}
                    onChange={handleInput}
                    rows={1}
                />
                <PrivacyCheckbox isChecked={isChecked} onChange={handleCheckboxChange} />
                <button
                    type="submit"
                    className={isSubmitEnabled ? 'action' : 'button-gray'}
                    disabled={!isSubmitEnabled}
                >
                    {isPending ? t('FeedbackForm.submitting') : t('FeedbackForm.submit')}
                </button>
            </form>
            <hr />
            <ContactSection />
        </div>
    )
}

export { FeedbackForm }
