import './FeedbackForm.css'

import { ChangeEvent, FC, useActionState, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { sendAnalyticsEvent } from '../../../hooks/useAnalytics'
import { useFeedback } from '../../../hooks/useFeedback'
import { ContactSection } from '../../Modals/ContactSection/ContactSection'
import { FeedbackSummaryModal } from '../../Modals/FeedbackSummaryModal/FeedbackSummaryModal'
import { PrivacyCheckbox } from '../PrivacyCheckbox/PrivacyCheckbox'

interface FeedbackFormProps {
    openAnimationClass?: string
    onClose?: () => void
}

const FeedbackForm: FC<FeedbackFormProps> = ({ openAnimationClass, onClose }) => {
    const { t } = useTranslation()
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const { submitFeedback } = useFeedback()
    const [isChecked, setIsChecked] = useState(false)
    const [hasContent, setHasContent] = useState(false)

    const formAction = async (previousState: boolean | null, formData: FormData): Promise<boolean> => {
        const feedback = formData.get('feedback') as string
        const success = await submitFeedback(feedback)

        if (success) {
            await sendAnalyticsEvent('Feedback submitted', {})
        }

        return success
    }

    const [showSummary, action, isPending] = useActionState(formAction, false)

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
            <form action={action}>
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
