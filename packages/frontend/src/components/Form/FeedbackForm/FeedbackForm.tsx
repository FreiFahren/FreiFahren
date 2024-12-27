import './FeedbackForm.css'
import React, { FC, ChangeEvent, useRef, useActionState, useState } from 'react'
import { ContactSection } from '../../Modals/ContactSection/ContactSection'
import { sendAnalyticsEvent } from '../../../hooks/useAnalytics'
import { useTranslation } from 'react-i18next'
import { FeedbackSummaryModal } from '../../Modals/FeedbackSummaryModal/FeedbackSummaryModal'
import { PrivacyCheckbox } from '../PrivacyCheckbox/PrivacyCheckbox'

async function submitFeedback(previousState: boolean | null, formData: FormData): Promise<boolean> {
    const feedback = formData.get('feedback') as string

    if (!feedback?.trim()) {
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
    const hasContentRef = useRef(false)

    const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value.trim()
        hasContentRef.current = value.length > 0

        // Adjust textarea height
        e.target.style.height = 'auto'
        e.target.style.height = `${e.target.scrollHeight}px`

        // Force re-render to update button state
        setIsChecked((prev) => prev)
    }

    const handleCheckboxChange = (checked: boolean) => {
        setIsChecked(checked)
    }

    const isSubmitEnabled = isChecked && hasContentRef.current && !isPending

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
